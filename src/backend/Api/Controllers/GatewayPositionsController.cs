using Core.Features.GatewayData.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class GatewayPositionsController(GatewayPositionsQueryHandler queryHandler) : ControllerBase
{
    [HttpGet("{gatewayId}")]
    public async Task<IActionResult> GetPositions(
        string gatewayId,
        [FromQuery] int hours = 24,
        CancellationToken cancellationToken = default)
    {
        var clampedHours = Math.Clamp(hours, 1, 24 * 90);
        var positions = await queryHandler.GetPositionsAsync(gatewayId, clampedHours, cancellationToken);
        return Ok(positions);
    }

    [HttpGet("{gatewayId}/latest")]
    public async Task<IActionResult> GetLatest(
        string gatewayId,
        CancellationToken cancellationToken = default)
    {
        var position = await queryHandler.GetLatestPositionAsync(gatewayId, cancellationToken);
        if (position is null)
            return NotFound();

        return Ok(position);
    }

    [HttpGet("{gatewayId}/activity")]
    public async Task<IActionResult> GetActivity(
        string gatewayId,
        [FromQuery] int hours = 24,
        CancellationToken cancellationToken = default)
    {
        var clampedHours = Math.Clamp(hours, 1, 24 * 90);
        var buckets = await queryHandler.GetActivityAsync(gatewayId, clampedHours, cancellationToken);
        return Ok(buckets);
    }

    [HttpGet("{gatewayId}/driveby")]
    public async Task<IActionResult> GetDriveBy(
        string gatewayId,
        [FromQuery] int hours = 24,
        CancellationToken cancellationToken = default)
    {
        var clampedHours = Math.Clamp(hours, 1, 24 * 90);
        var positions = await queryHandler.GetDriveByPositionsAsync(gatewayId, clampedHours, cancellationToken);
        return Ok(positions);
    }
}
