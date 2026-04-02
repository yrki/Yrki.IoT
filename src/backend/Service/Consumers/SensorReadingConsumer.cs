using Contracts.Readings;
using Core.Contexts;
using Core.Features.EncryptionKeys;
using Core.Models;
using Core.Services.Encryption;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Security.Cryptography;
using service.Services;
using Yrki.IoT.WMBus.Parser;
using Yrki.IoT.WMBus.Parser.Extensions;

namespace service.Consumers;

public class SensorReadingConsumer(
    DatabaseContext db,
    ISensorHubNotifier hubNotifier,
    IKeyEncryptionService keyEncryptionService,
    ILogger<SensorReadingConsumer> logger) : IConsumer<SensorPayload>
{
    private readonly Parser _parser = new();

    public async Task Consume(ConsumeContext<SensorPayload> context)
    {
        var msg = context.Message;
        var payloadHex = msg.PayloadHex;
        var rawMessage = WMBusFrameReader.NormalizeFrame(msg.PayloadHex.ToByteArray());

        WMBusMessage? header;
        try
        {
            header = _parser.ParseHeader(rawMessage);
        }
        catch (NotImplementedException ex)
        {
            await HandleUnsupportedEncryptionAsync(rawMessage, msg, ex, context.CancellationToken);
            return;
        }

        var metadata = WMBusMessageMetadataMapper.Map(header);
        var sensorId = header.AField;
        await UpsertGatewayContactAsync(msg.GatewayId, sensorId, msg.Rssi, msg.Timestamp, context.CancellationToken);
        var encryptionKey = await ResolveEncryptionKeyAsync(header, rawMessage, payloadHex, context.CancellationToken);

        if (header.EncryptionMethod != EncryptionMethod.None && string.IsNullOrWhiteSpace(encryptionKey))
        {
            await HandleMissingEncryptionKeyAsync(msg, sensorId, metadata, context.CancellationToken);
            return;
        }

        var payload = await TryParsePayloadAsync(rawMessage, header, encryptionKey, msg, context.CancellationToken);
        if (payload is null)
        {
            await UpsertUnknownDeviceAsync(sensorId, metadata, msg.Timestamp, context.CancellationToken);
            return;
        }

        var readings = MapReadings(
            sensorId,
            header,
            metadata,
            payload,
            rawMessage,
            encryptionKey,
            msg.Timestamp,
            payloadHex,
            msg.GatewayId,
            msg.Rssi);
        if (readings.Count == 0)
            return;

        await StoreRawPayloadAsync(msg, sensorId, metadata.Manufacturer, null, context.CancellationToken);
        await UpsertDeviceAsync(readings[0], metadata, context.CancellationToken);
        await PersistReadingsAsync(readings, metadata, context.CancellationToken);
        await PublishNotificationsAsync(readings, context.CancellationToken);
    }

    private async Task HandleMissingEncryptionKeyAsync(
        SensorPayload msg,
        string sensorId,
        WMBusMessageMetadata metadata,
        CancellationToken cancellationToken)
    {
        logger.LogWarning(
            "Missing encryption key for device {DeviceId} ({Manufacturer}). Add a key and future payloads will be decrypted.",
            sensorId,
            metadata.Manufacturer);

        await StoreRawPayloadAsync(msg, sensorId, metadata.Manufacturer, "Missing encryption key", cancellationToken);
        await UpsertUnknownDeviceAsync(sensorId, metadata, msg.Timestamp, cancellationToken);
    }

    private async Task HandleUnsupportedEncryptionAsync(
        byte[] rawMessage,
        SensorPayload msg,
        NotImplementedException ex,
        CancellationToken cancellationToken)
    {
        var deviceId = WMBusFrameReader.ReadAField(rawMessage);
        var manufacturer = WMBusFrameReader.ReadManufacturer(rawMessage);
        var encryptionKey = await ResolveEncryptionKeyAsync(deviceId, manufacturer, msg.PayloadHex, cancellationToken);
        var hasEncryptionKey = !string.IsNullOrWhiteSpace(encryptionKey);

        var guidance = hasEncryptionKey
            ? "An encryption key is configured, but the parser does not support this encryption method yet."
            : "Add an encryption key for this device or update the parser.";
        var errorMessage = hasEncryptionKey
            ? $"{ex.Message} (encryption key found, but parser support is missing)"
            : ex.Message;

        logger.LogWarning(
            "Unsupported encryption method for device {DeviceId} ({Manufacturer}): {Message}. " +
            "{Guidance}",
            deviceId, manufacturer, ex.Message, guidance);

        await StoreRawPayloadAsync(msg, deviceId, manufacturer, errorMessage, cancellationToken);

        await UpsertDeviceAsync(
            new SensorReading
            {
                SensorId = deviceId,
                Manufacturer = manufacturer,
                Timestamp = msg.Timestamp,
                SensorType = "Unknown",
                GatewayId = msg.GatewayId,
                Rssi = msg.Rssi,
                Value = 0
            },
            new WMBusMessageMetadata(manufacturer, "Unknown"),
            cancellationToken);
    }

    private async Task<IParsedPayload?> TryParsePayloadAsync(
        byte[] rawMessage,
        WMBusMessage header,
        string encryptionKey,
        SensorPayload msg,
        CancellationToken cancellationToken)
    {
        try
        {
            return _parser.ParsePayload(rawMessage, encryptionKey);
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Failed to parse payload for sensor {SensorId} ({Manufacturer}). Raw payload: {PayloadHex}",
                header.AField,
                header.MField,
                msg.PayloadHex);
            var metadata = WMBusMessageMetadataMapper.Map(header);
            await StoreRawPayloadAsync(msg, header.AField, metadata.Manufacturer, ex.Message, cancellationToken);
            return null;
        }
    }

    private async Task<string> ResolveEncryptionKeyAsync(
        WMBusMessage header,
        byte[] rawMessage,
        string payloadHex,
        CancellationToken cancellationToken)
    {
        if (header.EncryptionMethod == EncryptionMethod.None)
            return string.Empty;

        var manufacturer = EncryptionKeyIdentity.NormalizeManufacturer(header.MField);
        var deviceId = EncryptionKeyIdentity.NormalizeDeviceUniqueId(header.AField);
        return await ResolveEncryptionKeyAsync(deviceId, manufacturer, payloadHex, cancellationToken);
    }

    private async Task<string> ResolveEncryptionKeyAsync(
        string? deviceId,
        string? manufacturer,
        string payloadHex,
        CancellationToken cancellationToken)
    {
        EncryptionKey? dbKey;
        try
        {
            dbKey = await db.EncryptionKeys
                .AsNoTracking()
                .Where(k => k.DeviceUniqueId == deviceId && (k.Manufacturer == manufacturer || k.Manufacturer == null))
                .OrderByDescending(k => k.Manufacturer == manufacturer)
                .FirstOrDefaultAsync(cancellationToken);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedColumn)
        {
            logger.LogWarning(
                "EncryptionKeys.Manufacturer column is missing. Falling back to legacy key lookup by device id only. Apply the latest database migration.");

            dbKey = await db.EncryptionKeys
                .AsNoTracking()
                .FirstOrDefaultAsync(k => k.DeviceUniqueId == deviceId, cancellationToken);
        }

        if (dbKey is not null)
        {
            var resolvedDatabaseKey = TryResolveDatabaseEncryptionKey(dbKey, deviceId, manufacturer, payloadHex);
            if (!string.IsNullOrWhiteSpace(resolvedDatabaseKey))
                return resolvedDatabaseKey;
        }

        return string.Empty;
    }

    private string? TryResolveDatabaseEncryptionKey(
        EncryptionKey dbKey,
        string? deviceId,
        string? manufacturer,
        string payloadHex)
    {
        try
        {
            return keyEncryptionService.Decrypt(dbKey.EncryptedKeyValue);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException)
        {
            if (LooksLikeHexKey(dbKey.EncryptedKeyValue))
            {
                return dbKey.EncryptedKeyValue.Trim().ToUpperInvariant();
            }

            logger.LogWarning(
                ex,
                "Stored encryption key for device {DeviceId} ({Manufacturer}) could not be decrypted. Check Encryption__MasterKey or re-save the key. Raw payload: {PayloadHex}",
                deviceId,
                manufacturer,
                payloadHex);

            return null;
        }
    }

    private static bool LooksLikeHexKey(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Length != 32)
            return false;

        foreach (var c in trimmed)
        {
            var isHexDigit =
                (c >= '0' && c <= '9') ||
                (c >= 'a' && c <= 'f') ||
                (c >= 'A' && c <= 'F');

            if (!isHexDigit)
                return false;
        }

        return true;
    }

    private List<SensorReading> MapReadings(
        string sensorId,
        WMBusMessage header,
        WMBusMessageMetadata metadata,
        IParsedPayload payload,
        byte[] rawMessage,
        string encryptionKey,
        DateTimeOffset timestamp,
        string payloadHex,
        string? gatewayId,
        int? rssi)
    {
        var readings = SensorReadingMapper.Map(sensorId, metadata, payload, timestamp);
        if (readings.Count == 0 &&
            payload is Yrki.IoT.WMBus.Parser.Manufacturers.Axioma.Payloads.Axioma_Qalcosonic_WaterMeter &&
            !string.IsNullOrWhiteSpace(encryptionKey))
        {
            readings = AxiomaCompactPayloadParser.Parse(rawMessage, sensorId, metadata.Manufacturer, timestamp, encryptionKey).ToList();
        }

        foreach (var reading in readings)
        {
            reading.GatewayId = gatewayId;
            reading.Rssi = rssi;
        }

        if (readings.Count == 0)
        {
            logger.LogWarning(
                "No mappable readings for sensor {SensorId} payload type {Type}. Raw payload: {PayloadHex}",
                header.AField,
                payload.GetType().Name,
                payloadHex);
        }
        return readings;
    }

    private async Task StoreRawPayloadAsync(
        SensorPayload msg,
        string? deviceId,
        string? manufacturer,
        string? error,
        CancellationToken cancellationToken)
    {
        db.RawPayloads.Add(new RawPayload
        {
            Id = Guid.NewGuid(),
            ReceivedAt = msg.Timestamp,
            PayloadHex = msg.PayloadHex,
            Source = msg.Source,
            DeviceId = deviceId,
            Manufacturer = manufacturer,
            GatewayId = msg.GatewayId,
            Rssi = msg.Rssi,
            Error = error,
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task UpsertGatewayContactAsync(
        string? gatewayId,
        string sensorId,
        int? rssi,
        DateTimeOffset timestamp,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(gatewayId))
            return;

        var normalizedGatewayId = gatewayId.Trim();
        var gateway = await db.Devices.FirstOrDefaultAsync(d => d.UniqueId == normalizedGatewayId, cancellationToken);
        if (gateway is null)
        {
            db.Devices.Add(new Device
            {
                Id = Guid.NewGuid(),
                UniqueId = normalizedGatewayId,
                Name = normalizedGatewayId,
                Type = "Gateway",
                Description = string.Empty,
                Kind = DeviceKind.Gateway,
                IsNew = false,
                IsDeleted = false,
                LastContact = timestamp,
                InstallationDate = timestamp,
            });
        }
        else
        {
            gateway.Kind = DeviceKind.Gateway;
            gateway.Type = "Gateway";
            gateway.LastContact = timestamp;
            if (string.IsNullOrWhiteSpace(gateway.Name))
                gateway.Name = normalizedGatewayId;
        }

        db.GatewayReadings.Add(new GatewayReading
        {
            Id = Guid.NewGuid(),
            GatewayUniqueId = normalizedGatewayId,
            SensorUniqueId = sensorId,
            Rssi = rssi,
            ReceivedAt = timestamp,
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task PersistReadingsAsync(
        List<SensorReading> readings,
        WMBusMessageMetadata metadata,
        CancellationToken cancellationToken)
    {
        db.SensorReadings.AddRange(readings);
        await db.SaveChangesAsync(cancellationToken);
        if (logger.IsEnabled(LogLevel.Information))
            logger.LogInformation("Stored {Count} readings for sensor {SensorId} ({Manufacturer}, {DeviceType})",
                readings.Count, readings[0].SensorId, metadata.Manufacturer, metadata.DeviceType);
    }

    private async Task UpsertDeviceAsync(
        SensorReading reading,
        WMBusMessageMetadata metadata,
        CancellationToken cancellationToken)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.UniqueId == reading.SensorId, cancellationToken);
        if (device is null)
        {
            db.Devices.Add(new Device
            {
                Id = Guid.NewGuid(),
                UniqueId = reading.SensorId,
                Name = reading.SensorId,
                Type = metadata.DeviceType,
                Description = string.Empty,
                Manufacturer = metadata.Manufacturer,
                Kind = DeviceKind.Sensor,
                IsNew = true,
                LastContact = reading.Timestamp,
                InstallationDate = reading.Timestamp,
            });
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        device.Type = metadata.DeviceType;
        device.Manufacturer = metadata.Manufacturer;
        device.Kind = DeviceKind.Sensor;
        device.LastContact = reading.Timestamp;
        await db.SaveChangesAsync(cancellationToken);
    }

    private Task UpsertUnknownDeviceAsync(
        string sensorId,
        WMBusMessageMetadata metadata,
        DateTimeOffset timestamp,
        CancellationToken cancellationToken) =>
        UpsertDeviceAsync(
            new SensorReading
            {
                SensorId = sensorId,
                Manufacturer = metadata.Manufacturer,
                Timestamp = timestamp,
                SensorType = metadata.DeviceType,
                GatewayId = null,
                Rssi = null,
                Value = 0
            },
            metadata,
            cancellationToken);

    private async Task PublishNotificationsAsync(List<SensorReading> readings, CancellationToken cancellationToken)
    {
        foreach (var reading in readings)
        {
            await hubNotifier.NotifyReadingAsync(
                reading.SensorId, reading.SensorType, reading.Value, reading.Timestamp, cancellationToken);
        }
    }
}
