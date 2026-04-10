using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using service.Services;

namespace service.Consumers;

public class SensorReadingReceivedConsumer(
    DatabaseContext db,
    ISensorHubNotifier hubNotifier,
    ILogger<SensorReadingReceivedConsumer> logger)
{
    public async Task HandleAsync(SensorReadingReceived msg, CancellationToken cancellationToken)
    {
        var device = await db.Devices.SingleOrDefaultAsync(device => device.UniqueId == msg.SensorId, cancellationToken);

        try
        {
            var reading = new SensorReading
            {
                SensorId = msg.SensorId,
                SensorType = msg.SensorType,
                Manufacturer = msg.Manufacturer,
                GatewayId = msg.GatewayId,
                Rssi = msg.Rssi,
                Value = msg.Value,
                Timestamp = msg.Timestamp,
            };

            db.SensorReadings.Add(reading);

            if (device is not null && device.LastContact < msg.Timestamp)
            {
                device.LastContact = msg.Timestamp;
            }

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        {
            logger.LogDebug("Duplicate reading ignored for {SensorId}/{SensorType} at {Timestamp}",
                msg.SensorId, msg.SensorType, msg.Timestamp);
        }

        await hubNotifier.NotifyReadingAsync(
            msg.SensorId, msg.SensorType, msg.Value, msg.Timestamp, cancellationToken);
    }
}
