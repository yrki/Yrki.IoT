using Contracts.Requests;
using Core.Features.Devices.Command;
using Core.Features.Sensors.Command;
using Core.Features.Sensors.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class DevicesController(
    AllSensorsQueryHandler allSensorsQueryHandler,
    AllGatewaysQueryHandler allGatewaysQueryHandler,
    SensorsByLocationQueryHandler sensorsByLocationQueryHandler,
    SensorsBySensorLocationQueryHandler sensorsBySensorLocationQueryHandler,
    SensorByUniqueIdQueryHandler sensorByUniqueIdQueryHandler,
    UpdateDeviceCommandHandler updateHandler,
    AssignDevicesToLocationCommandHandler assignDevicesToLocationHandler,
    DeleteSensorCommandHandler deleteHandler) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var sensors = await allSensorsQueryHandler.HandleAsync(cancellationToken);
        return Ok(sensors);
    }

    [HttpGet("gateways")]
    public async Task<IActionResult> GetGateways(CancellationToken cancellationToken)
    {
        var gateways = await allGatewaysQueryHandler.HandleAsync(cancellationToken);
        return Ok(gateways);
    }

    [HttpGet("location/{locationId:guid}")]
    public async Task<IActionResult> GetByLocation(Guid locationId, CancellationToken cancellationToken)
    {
        var sensors = await sensorsByLocationQueryHandler.HandleAsync(locationId, cancellationToken);
        return Ok(sensors);
    }

    [HttpGet("sensor/{sensorId}")]
    public async Task<IActionResult> GetBySensorLocation(string sensorId, CancellationToken cancellationToken)
    {
        var sensors = await sensorsBySensorLocationQueryHandler.HandleAsync(sensorId, cancellationToken);
        return Ok(sensors);
    }

    [HttpGet("unique/{sensorId}")]
    public async Task<IActionResult> GetByUniqueId(string sensorId, CancellationToken cancellationToken)
    {
        var sensor = await sensorByUniqueIdQueryHandler.HandleAsync(sensorId, cancellationToken);
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

    [HttpPost("assign-to-location")]
    public async Task<IActionResult> AssignToLocation(
        [FromBody] AssignDevicesToLocationRequest request,
        CancellationToken cancellationToken)
    {
        var affected = await assignDevicesToLocationHandler.HandleAsync(request, cancellationToken);
        if (affected < 0)
            return NotFound();

        return Ok(new { affected });
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
