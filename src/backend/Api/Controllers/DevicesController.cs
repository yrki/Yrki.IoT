using Core.Features.Sensors.Query;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class DevicesController(SensorsQueryHandler queryHandler) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var sensors = await queryHandler.HandleAsync(cancellationToken);
        return Ok(sensors);
    }

    [HttpGet("location/{locationId:guid}")]
    public async Task<IActionResult> GetByLocation(Guid locationId, CancellationToken cancellationToken)
    {
        var sensors = await queryHandler.HandleByLocationAsync(locationId, cancellationToken);
        return Ok(sensors);
    }
}
