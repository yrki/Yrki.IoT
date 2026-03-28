using Api.Hubs;
using Contracts.Readings;
using MassTransit;
using Microsoft.AspNetCore.SignalR;

namespace Api.Consumers;

public class SensorReadingReceivedConsumer(
    IHubContext<SensorHub> hubContext,
    ILogger<SensorReadingReceivedConsumer> logger) : IConsumer<SensorReadingReceived>
{
    public async Task Consume(ConsumeContext<SensorReadingReceived> context)
    {
        var msg = context.Message;

        await hubContext.Clients.All.SendAsync("SensorReadingReceived", new
        {
            msg.SensorId,
            msg.SensorType,
            msg.Value,
            Timestamp = msg.Timestamp.ToString("O"),
        }, context.CancellationToken);

        logger.LogDebug("Pushed {SensorType}={Value} for {SensorId} to SignalR",
            msg.SensorType, msg.Value, msg.SensorId);
    }
}
