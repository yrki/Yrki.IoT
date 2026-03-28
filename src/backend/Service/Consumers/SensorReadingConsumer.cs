using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using MassTransit;
using Microsoft.Extensions.Options;
using service.Configuration;
using Yrki.IoT.WMBus.Parser;

namespace service.Consumers;

public class SensorReadingConsumer(
    DatabaseContext db,
    IOptions<WMBusOptions> wmBusOptions,
    ILogger<SensorReadingConsumer> logger) : IConsumer<SensorPayload>
{
    private readonly Parser _parser = new();

    public async Task Consume(ConsumeContext<SensorPayload> context)
    {
        var msg = context.Message;
        var header = _parser.ParseHeader(msg.RawMessage);

        if (!TryParsePayload(msg.RawMessage, header, out var payload))
            return;

        var readings = MapReadings(header, payload!, msg.Timestamp);
        if (readings.Count == 0)
            return;

        await PersistReadingsAsync(readings, header, context.CancellationToken);
    }

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
