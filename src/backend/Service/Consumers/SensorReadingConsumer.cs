using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using Core.Services.Encryption;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using service.Configuration;
using Yrki.IoT.WMBus.Parser;

namespace service.Consumers;

public class SensorReadingConsumer(
    DatabaseContext db,
    IBus bus,
    IKeyEncryptionService keyEncryptionService,
    IOptions<WMBusOptions> wmBusOptions,
    ILogger<SensorReadingConsumer> logger) : IConsumer<SensorPayload>
{
    private readonly Parser _parser = new();

    public async Task Consume(ConsumeContext<SensorPayload> context)
    {
        var msg = context.Message;
        var header = _parser.ParseHeader(msg.RawMessage);

        var payload = await TryParsePayloadAsync(msg.RawMessage, header, context.CancellationToken);
        if (payload is null)
            return;

        var readings = MapReadings(header, payload, msg.Timestamp);
        if (readings.Count == 0)
            return;

        await PersistReadingsAsync(readings, header, context.CancellationToken);
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

    private async Task PublishNotificationsAsync(List<SensorReading> readings, CancellationToken cancellationToken)
    {
        foreach (var reading in readings)
        {
            await bus.Publish(new SensorReadingReceived(
                reading.SensorId,
                reading.SensorType,
                reading.Manufacturer,
                reading.Value,
                reading.Timestamp), cancellationToken);
        }
    }
}
