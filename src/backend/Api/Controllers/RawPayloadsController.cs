using Core.Features.RawPayloads.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class RawPayloadsController(RawPayloadsQueryHandler queryHandler) : ControllerBase
{
    private const int MaxLimit = 500;
    private const int DefaultLimit = 100;

    [HttpGet("device/{deviceId}")]
    public async Task<IActionResult> GetByDevice(
        string deviceId,
        [FromQuery] int limit = DefaultLimit,
        CancellationToken cancellationToken = default)
    {
        var clampedLimit = Math.Clamp(limit, 1, MaxLimit);
        var payloads = await queryHandler.HandleAsync(deviceId, clampedLimit, cancellationToken);
        return Ok(payloads);
    }
}
