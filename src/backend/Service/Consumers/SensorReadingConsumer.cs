using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using service.Configuration;
using Yrki.IoT.WMBus.Parser;
using CoreDeviceType = Core.Models.DeviceType;
using WMBusDeviceType = Yrki.IoT.WMBus.Parser.DeviceType;

namespace service.Consumers;

public class SensorReadingConsumer(
    DatabaseContext db,
    IOptions<WMBusOptions> wmBusOptions,
    ILogger<SensorReadingConsumer> logger) : IConsumer<SensorPayload>
{
    private static readonly Guid UnknownLocationId = new("00000000-0000-0000-0000-000000000001");
    private readonly Parser _parser = new();

    public async Task Consume(ConsumeContext<SensorPayload> context)
    {
        var msg = context.Message;
        var header = _parser.ParseHeader(msg.RawMessage);

        await EnsureDeviceRegisteredAsync(header, msg.Timestamp, context.CancellationToken);

        if (!TryParsePayload(msg.RawMessage, header, out var payload))
            return;

        var readings = MapReadings(header, payload!, msg.Timestamp);
        if (readings.Count == 0)
            return;

        await PersistReadingsAsync(readings, header, context.CancellationToken);
    }

    private async Task EnsureDeviceRegisteredAsync(WMBusMessage header, DateTimeOffset timestamp, CancellationToken cancellationToken)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.UniqueId == header.AField, cancellationToken);

        if (device is null)
        {
            device = new Device
            {
                Id = Guid.NewGuid(),
                UniqueId = header.AField,
                Name = null,
                Description = string.Empty,
                Type = MapDeviceType(header.DeviceType),
                Manufacturer = header.MField,
                IsNew = true,
                LocationId = UnknownLocationId,
                LastContact = timestamp,
                InstallationDate = timestamp,
            };
            db.Devices.Add(device);
            logger.LogInformation("Registered new device {UniqueId} (manufacturer={Manufacturer}, type={Type})",
                header.AField, header.MField, device.Type);
        }
        else
        {
            device.LastContact = timestamp;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static CoreDeviceType MapDeviceType(WMBusDeviceType wmBusType) => wmBusType switch
    {
        WMBusDeviceType.CarbonDioxide
            or WMBusDeviceType.RoomSensor => CoreDeviceType.CO2,
        WMBusDeviceType.WaterMeter
            or WMBusDeviceType.WarmWater
            or WMBusDeviceType.ColdWater
            or WMBusDeviceType.HotWater
            or WMBusDeviceType.WasteWater => CoreDeviceType.WATER,
        _ => CoreDeviceType.PassiveIR,
    };

    private bool TryParsePayload(byte[] rawMessage, WMBusMessage header, out IParsedPayload? payload)
    {
        var encryptionKey = ResolveEncryptionKey(header);
        try
        {
            payload = _parser.ParsePayload(rawMessage, encryptionKey);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to parse payload for sensor {SensorId} ({Manufacturer})", header.AField, header.MField);
            payload = null;
            return false;
        }
    }

    private string ResolveEncryptionKey(WMBusMessage header) =>
        header.EncryptionMethod == EncryptionMethod.None
            ? string.Empty
            : wmBusOptions.Value.DeviceKeys.GetValueOrDefault(header.AField, string.Empty);

    private List<SensorReading> MapReadings(WMBusMessage header, IParsedPayload payload, DateTimeOffset timestamp)
    {
        var readings = SensorReadingMapper.Map(header, payload, timestamp);
        if (readings.Count == 0)
            logger.LogWarning("No mappable readings for sensor {SensorId} payload type {Type}", header.AField, payload.GetType().Name);
        return readings;
    }

    private async Task PersistReadingsAsync(List<SensorReading> readings, WMBusMessage header, CancellationToken cancellationToken)
    {
        db.SensorReadings.AddRange(readings);
        await db.SaveChangesAsync(cancellationToken);
        if (logger.IsEnabled(LogLevel.Information))
            logger.LogInformation("Stored {Count} readings for sensor {SensorId} ({DeviceType})",
                readings.Count, header.AField, header.DeviceType.ToString());
    }
}
