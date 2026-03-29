using Api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Api.Controllers;

[ApiController]
[Route("internal/sensor-readings")]
[ApiExplorerSettings(IgnoreApi = true)]
public class InternalSensorReadingsController(IHubContext<SensorHub> hubContext) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Push(
        [FromBody] SensorReadingNotification notification,
        CancellationToken cancellationToken)
    {
        await hubContext.Clients.All.SendAsync("SensorReadingReceived", new
        {
            notification.SensorId,
            notification.SensorType,
            notification.Value,
            Timestamp = notification.Timestamp.ToString("O"),
        }, cancellationToken);

        return Ok();
    }
}

public record SensorReadingNotification(string SensorId, string SensorType, decimal Value, DateTimeOffset Timestamp);
