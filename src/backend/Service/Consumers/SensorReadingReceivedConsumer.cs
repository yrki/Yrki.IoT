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

        await TrackGatewayContactAsync(msg, cancellationToken);

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

    private async Task TrackGatewayContactAsync(SensorReadingReceived msg, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(msg.GatewayId))
            return;

        var gatewayId = msg.GatewayId.Trim();

        var gateway = await db.Devices.FirstOrDefaultAsync(d => d.UniqueId == gatewayId, cancellationToken);
        if (gateway is null)
        {
            db.Devices.Add(new Device
            {
                Id = Guid.NewGuid(),
                UniqueId = gatewayId,
                Name = gatewayId,
                Type = "Gateway",
                Description = string.Empty,
                Kind = DeviceKind.Gateway,
                LastContact = msg.Timestamp,
                InstallationDate = msg.Timestamp,
            });
        }
        else if (gateway.LastContact < msg.Timestamp)
        {
            gateway.LastContact = msg.Timestamp;
        }

        db.GatewayReadings.Add(new GatewayReading
        {
            Id = Guid.NewGuid(),
            GatewayUniqueId = gatewayId,
            SensorUniqueId = msg.SensorId,
            Rssi = msg.Rssi,
            ReceivedAt = msg.Timestamp,
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
