using Core.Features.SensorData.Query;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class SensorReadingsController(SensorReadingsQueryHandler queryHandler) : ControllerBase
{
    [HttpGet("sensors")]
    public async Task<IActionResult> GetSensorIds(CancellationToken cancellationToken)
    {
        var ids = await queryHandler.GetDistinctSensorIdsAsync(cancellationToken);
        return Ok(ids);
    }

    [HttpGet("{sensorId}/recent")]
    public async Task<IActionResult> GetRecent(
        string sensorId,
        [FromQuery] int hours = 3,
        CancellationToken cancellationToken = default)
    {
        var readings = await queryHandler.HandleAsync(new SensorReadingQuery(sensorId, hours), cancellationToken);
        return Ok(readings);
    }

    [HttpGet("{sensorId}/latest")]
    public async Task<IActionResult> GetLatest(
        string sensorId,
        CancellationToken cancellationToken = default)
    {
        var readings = await queryHandler.HandleLatestAsync(sensorId, cancellationToken);
        return Ok(readings);
    }

    [HttpGet("{sensorId}/gateways")]
    public async Task<IActionResult> GetGateways(
        string sensorId,
        CancellationToken cancellationToken = default)
    {
        var gateways = await queryHandler.GetGatewayStatisticsAsync(sensorId, cancellationToken);
        return Ok(gateways);
    }

    [HttpGet("gateway/{gatewayId}/sensors")]
    public async Task<IActionResult> GetSensorsForGateway(
        string gatewayId,
        CancellationToken cancellationToken = default)
    {
        var sensors = await queryHandler.GetSensorStatisticsForGatewayAsync(gatewayId, cancellationToken);
        return Ok(sensors);
    }
}
