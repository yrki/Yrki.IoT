using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using Core.Services.Encryption;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using service.Configuration;
using service.Services;
using Yrki.IoT.WMBus.Parser;
using Yrki.IoT.WMBus.Parser.Extensions;

namespace service.Consumers;

public class SensorReadingConsumer(
    DatabaseContext db,
    ISensorHubNotifier hubNotifier,
    IKeyEncryptionService keyEncryptionService,
    IOptions<WMBusOptions> wmBusOptions,
    ILogger<SensorReadingConsumer> logger) : IConsumer<SensorPayload>
{
    private readonly Parser _parser = new();

    public async Task Consume(ConsumeContext<SensorPayload> context)
    {
        var msg = context.Message;
        var rawMessage = msg.PayloadHex.ToByteArray();
        var header = _parser.ParseHeader(rawMessage);
        var metadata = WMBusMessageMetadataMapper.Map(header);

        var payload = await TryParsePayloadAsync(rawMessage, header, context.CancellationToken);
        if (payload is null)
            return;

        var readings = MapReadings(header, metadata, payload, msg.Timestamp);
        if (readings.Count == 0)
            return;

        await UpsertDeviceAsync(readings[0], metadata, context.CancellationToken);
        await PersistReadingsAsync(readings, metadata, context.CancellationToken);
        await PublishNotificationsAsync(readings, context.CancellationToken);
    }

    private async Task<IParsedPayload?> TryParsePayloadAsync(byte[] rawMessage, WMBusMessage header, CancellationToken cancellationToken)
    {
        var encryptionKey = await ResolveEncryptionKeyAsync(header, cancellationToken);
        try
        {
            return _parser.ParsePayload(rawMessage, encryptionKey);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to parse payload for sensor {SensorId} ({Manufacturer})", header.AField, header.MField);
            return null;
        }
    }

    private async Task<string> ResolveEncryptionKeyAsync(WMBusMessage header, CancellationToken cancellationToken)
    {
        if (header.EncryptionMethod == EncryptionMethod.None)
            return string.Empty;

        // Check database for device-specific key first, then group key
        var dbKey = await db.EncryptionKeys
            .AsNoTracking()
            .FirstOrDefaultAsync(k => k.DeviceUniqueId == header.AField, cancellationToken);

        if (dbKey is not null)
            return keyEncryptionService.Decrypt(dbKey.EncryptedKeyValue);

        // Fall back to config-based keys
        return wmBusOptions.Value.DeviceKeys.GetValueOrDefault(header.AField, string.Empty);
    }

    private List<SensorReading> MapReadings(
        WMBusMessage header,
        WMBusMessageMetadata metadata,
        IParsedPayload payload,
        DateTimeOffset timestamp)
    {
        var readings = SensorReadingMapper.Map(header, metadata, payload, timestamp);
        if (readings.Count == 0)
            logger.LogWarning("No mappable readings for sensor {SensorId} payload type {Type}", header.AField, payload.GetType().Name);
        return readings;
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
                Name = null,
                Type = metadata.DeviceType,
                Description = string.Empty,
                Manufacturer = metadata.Manufacturer,
                IsNew = true,
                LastContact = reading.Timestamp,
                InstallationDate = reading.Timestamp,
            });
            return;
        }

        device.Type = metadata.DeviceType;
        device.Manufacturer = metadata.Manufacturer;
        device.LastContact = reading.Timestamp;
    }

    private async Task PublishNotificationsAsync(List<SensorReading> readings, CancellationToken cancellationToken)
    {
        foreach (var reading in readings)
        {
            await hubNotifier.NotifyReadingAsync(
                reading.SensorId, reading.SensorType, reading.Value, reading.Timestamp, cancellationToken);
        }
    }
}
