using Api.Hubs;
using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using MassTransit;
using Microsoft.AspNetCore.SignalR;

namespace Api.Consumers;

public class SensorReadingReceivedConsumer(
    IHubContext<SensorHub> hubContext,
    DatabaseContext db,
    ILogger<SensorReadingReceivedConsumer> logger) : IConsumer<SensorReadingReceived>
{
    public async Task Consume(ConsumeContext<SensorReadingReceived> context)
    {
        var msg = context.Message;

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

        await hubContext.Clients.All.SendAsync("SensorReadingReceived", new
        {
            msg.SensorId,
            msg.SensorType,
            msg.Value,
            Timestamp = msg.Timestamp.ToString("O"),
        }, context.CancellationToken);

        logger.LogDebug("Stored and pushed {SensorType}={Value} for {SensorId}",
            msg.SensorType, msg.Value, msg.SensorId);
    }
}
