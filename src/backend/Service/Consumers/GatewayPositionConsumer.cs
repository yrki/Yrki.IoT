using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using service.Services;

namespace service.Consumers;

public class GatewayPositionConsumer(
    DatabaseContext db,
    ISensorHubNotifier hubNotifier,
    ILogger<GatewayPositionConsumer> logger)
{
    public async Task HandleAsync(GatewayPositionReceived msg, CancellationToken cancellationToken)
    {
        var position = new GatewayPosition
        {
            Timestamp = msg.Timestamp,
            GatewayUniqueId = msg.GatewayId,
            Longitude = msg.Longitude,
            Latitude = msg.Latitude,
            Heading = msg.Heading,
            DriveBy = msg.DriveBy,
        };

        db.GatewayPositions.Add(position);

        var device = await db.Devices.SingleOrDefaultAsync(
            d => d.UniqueId == msg.GatewayId && d.Kind == DeviceKind.Gateway,
            cancellationToken);

        if (device is not null && device.LastContact < msg.Timestamp)
        {
            device.LastContact = msg.Timestamp;

            if (msg.Latitude.HasValue)
                device.Latitude = msg.Latitude.Value;
            if (msg.Longitude.HasValue)
                device.Longitude = msg.Longitude.Value;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        {
            logger.LogDebug("Duplicate gateway position ignored for {GatewayId} at {Timestamp}",
                msg.GatewayId, msg.Timestamp);
            return;
        }
        catch (DbUpdateException ex)
        {
            logger.LogError(ex, "Failed to store gateway position for {GatewayId} at {Timestamp}",
                msg.GatewayId, msg.Timestamp);
            throw;
        }

        logger.LogDebug("Stored gateway position for {GatewayId} at {Timestamp}",
            msg.GatewayId, msg.Timestamp);

        await hubNotifier.NotifyGatewayPositionAsync(
            msg.GatewayId, msg.Timestamp, msg.Longitude, msg.Latitude, msg.Heading, msg.DriveBy, cancellationToken);
    }
}
