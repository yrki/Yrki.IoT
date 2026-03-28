using Core.Features.SensorData.Query;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class SensorReadingsController(SensorReadingsQueryHandler queryHandler) : ControllerBase
{
    [HttpGet("recent")]
    public async Task<IActionResult> GetRecent(
        [FromQuery] int hours = 3,
        CancellationToken cancellationToken = default)
    {
        var readings = await queryHandler.HandleAsync(new SensorReadingQuery(hours), cancellationToken);
        return Ok(readings);
    }

    [HttpGet("latest")]
    public async Task<IActionResult> GetLatest(CancellationToken cancellationToken)
    {
        var readings = await queryHandler.HandleLatestAsync(cancellationToken);
        return Ok(readings);
    }
}
