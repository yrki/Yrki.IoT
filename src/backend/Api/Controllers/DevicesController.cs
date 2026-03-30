using Contracts.Requests;
using Core.Features.Devices.Command;
using Core.Features.Sensors.Command;
using Core.Features.Sensors.Query;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class DevicesController(
    SensorsQueryHandler queryHandler,
    UpdateDeviceCommandHandler updateHandler,
    DeleteSensorCommandHandler deleteHandler) : ControllerBase
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

    [HttpGet("sensor/{sensorId}")]
    public async Task<IActionResult> GetBySensorLocation(string sensorId, CancellationToken cancellationToken)
    {
        var sensors = await queryHandler.HandleBySensorLocationAsync(sensorId, cancellationToken);
        return Ok(sensors);
    }

    [HttpGet("unique/{sensorId}")]
    public async Task<IActionResult> GetByUniqueId(string sensorId, CancellationToken cancellationToken)
    {
        var sensor = await queryHandler.HandleByUniqueIdAsync(sensorId, cancellationToken);
        if (sensor is null)
            return NotFound();

        return Ok(sensor);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateDeviceRequest request,
        CancellationToken cancellationToken)
    {
        var result = await updateHandler.HandleAsync(id, request, cancellationToken);
        if (result is null)
            return NotFound();

        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await deleteHandler.HandleAsync(id, cancellationToken);
        if (!deleted)
            return NotFound();

        return NoContent();
    }
}
