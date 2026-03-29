using Api.Hubs;
using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using MassTransit;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Api.Consumers;

public class SensorReadingReceivedConsumer(
    IHubContext<SensorHub> hubContext,
    DatabaseContext db,
    ILogger<SensorReadingReceivedConsumer> logger) : IConsumer<SensorReadingReceived>
{
    public async Task Consume(ConsumeContext<SensorReadingReceived> context)
    {
        var msg = context.Message;

        try
        {
            var reading = new SensorReading
            {
                SensorId = msg.SensorId,
                SensorType = msg.SensorType,
                Manufacturer = msg.Manufacturer,
                Value = msg.Value,
                Timestamp = msg.Timestamp,
            };

            db.SensorReadings.Add(reading);
            await db.SaveChangesAsync(context.CancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        {
            logger.LogDebug("Duplicate reading ignored for {SensorId}/{SensorType} at {Timestamp}",
                msg.SensorId, msg.SensorType, msg.Timestamp);
        }

        await hubContext.Clients.All.SendAsync("SensorReadingReceived", new
        {
            msg.SensorId,
            msg.SensorType,
            msg.Value,
            Timestamp = msg.Timestamp.ToString("O"),
        }, context.CancellationToken);
    }
}
