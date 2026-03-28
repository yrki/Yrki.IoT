using Contracts.Readings;
using Core.Contexts;
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

        var encryptionKey = header.EncryptionMethod == EncryptionMethod.None
            ? string.Empty
            : wmBusOptions.Value.DeviceKeys.GetValueOrDefault(header.AField, string.Empty);

        IParsedPayload payload;
        try
        {
            payload = _parser.ParsePayload(msg.RawMessage, encryptionKey);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to parse payload for sensor {SensorId} ({Manufacturer})", header.AField, header.MField);
            return;
        }

        var readings = SensorReadingMapper.Map(header, payload, msg.Timestamp);
        if (readings.Count == 0)
        {
            logger.LogWarning("No mappable readings for sensor {SensorId} payload type {Type}", header.AField, payload.GetType().Name);
            return;
        }

        db.SensorReadings.AddRange(readings);
        await db.SaveChangesAsync(context.CancellationToken);

        logger.LogInformation(
            "Stored {Count} readings for sensor {SensorId} ({DeviceType})",
            readings.Count, header.AField, header.DeviceType);
    }
}
