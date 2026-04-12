using Contracts.Requests;
using Core.Features.SensorData.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Authorize]
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
        [FromQuery] int? hours = null,
        CancellationToken cancellationToken = default)
    {
        var gateways = await queryHandler.GetGatewayStatisticsAsync(sensorId, hours, cancellationToken);
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

    [HttpGet("sensor-types")]
    public async Task<IActionResult> GetSensorTypes(
        [FromQuery] string? sensorIds = null,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<string>? idList = null;
        if (!string.IsNullOrWhiteSpace(sensorIds))
        {
            idList = sensorIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }

        var types = await queryHandler.GetDistinctSensorTypesAsync(idList, cancellationToken);
        return Ok(types);
    }

    [HttpPost("export")]
    public async Task<IActionResult> Export(
        [FromBody] ExportReadingsRequest request,
        CancellationToken cancellationToken = default)
    {
        var readings = await queryHandler.ExportAsync(
            request.SensorIds,
            request.SensorTypes,
            request.From,
            request.To,
            cancellationToken);
        return Ok(readings);
    }

    [HttpGet("coverage")]
    public async Task<IActionResult> GetCoverage(
        [FromQuery] int hours = 168,
        CancellationToken cancellationToken = default)
    {
        var clampedHours = Math.Clamp(hours, 1, 24 * 90);
        var connections = await queryHandler.GetCoverageConnectionsAsync(clampedHours, cancellationToken);
        return Ok(connections);
    }
}
