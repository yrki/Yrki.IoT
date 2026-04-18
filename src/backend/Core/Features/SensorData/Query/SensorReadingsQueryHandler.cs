using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.SensorData.Query;

public class SensorReadingsQueryHandler(DatabaseContext db, ILogger<SensorReadingsQueryHandler> logger)
{
    public async Task<IReadOnlyList<SensorReadingResponse>> HandleAsync(
        SensorReadingQuery query,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying sensor readings for {SensorId}", query.SensorId);

        var from = query.From ?? DateTimeOffset.UtcNow.AddHours(-query.Hours);
        var to = query.To ?? DateTimeOffset.UtcNow;

        return await db.SensorReadings
            .AsNoTracking()
            .Where(r => r.SensorId == query.SensorId && r.Timestamp >= from && r.Timestamp <= to)
            .OrderBy(r => r.Timestamp)
            .Select(r => new SensorReadingResponse(
                r.SensorId,
                r.SensorType,
                r.Value,
                r.Timestamp,
                r.GatewayId,
                r.Rssi))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SensorReadingResponse>> HandleLatestAsync(
        string sensorId,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying latest readings for sensor {SensorId}", sensorId);

        var sensorTypes = await db.SensorReadings
            .AsNoTracking()
            .Where(r => r.SensorId == sensorId)
            .Select(r => r.SensorType)
            .Distinct()
            .ToListAsync(cancellationToken);

        var results = new List<SensorReadingResponse>();
        foreach (var type in sensorTypes)
        {
            var reading = await db.SensorReadings
                .AsNoTracking()
                .Where(r => r.SensorId == sensorId && r.SensorType == type)
                .OrderByDescending(r => r.Timestamp)
                .Select(r => new SensorReadingResponse(
                    r.SensorId,
                    r.SensorType,
                    r.Value,
                    r.Timestamp,
                    r.GatewayId,
                    r.Rssi))
                .FirstOrDefaultAsync(cancellationToken);

            if (reading is not null)
                results.Add(reading);
        }

        return results;
    }

    public async Task<IReadOnlyList<string>> GetDistinctSensorIdsAsync(
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying distinct sensor IDs");

        return await db.SensorReadings
            .AsNoTracking()
            .Select(r => r.SensorId)
            .Distinct()
            .OrderBy(id => id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SensorGatewayResponse>> GetGatewayStatisticsAsync(
        string sensorId,
        int? hours = null,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying gateway statistics for sensor {SensorId}", sensorId);

        IQueryable<Core.Models.GatewayReading> query = db.GatewayReadings
            .AsNoTracking()
            .Where(reading => reading.SensorUniqueId == sensorId);

        if (hours.HasValue)
            query = query.Where(reading => reading.ReceivedAt >= DateTimeOffset.UtcNow.AddHours(-hours.Value));

        var readings = await query.ToListAsync(cancellationToken);

        return readings
            .GroupBy(reading => reading.GatewayUniqueId)
            .Select(group =>
            {
                var withRssi = group.Where(reading => reading.Rssi.HasValue).ToList();
                return new SensorGatewayResponse(
                    group.Key,
                    group.Count(),
                    withRssi.Count > 0 ? withRssi.Average(r => (decimal)r.Rssi!.Value) : 0m,
                    withRssi.Count > 0 ? withRssi.Min(r => r.Rssi!.Value) : null,
                    withRssi.Count > 0 ? withRssi.Max(r => r.Rssi!.Value) : null,
                    group.Max(reading => reading.ReceivedAt));
            })
            .OrderByDescending(gateway => gateway.LastSeenAt)
            .ToList();
    }

    public async Task<IReadOnlyList<GatewaySensorResponse>> GetSensorStatisticsForGatewayAsync(
        string gatewayId,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying sensor statistics for gateway {GatewayId}", gatewayId);

        var readings = await db.GatewayReadings
            .AsNoTracking()
            .Where(reading => reading.GatewayUniqueId == gatewayId)
            .ToListAsync(cancellationToken);

        return readings
            .GroupBy(reading => reading.SensorUniqueId)
            .Select(group => new GatewaySensorResponse(
                group.Key,
                group.Count(),
                group.Where(reading => reading.Rssi.HasValue).Average(reading => (decimal?)reading.Rssi) ?? 0m,
                group.Max(reading => reading.ReceivedAt)))
            .OrderByDescending(sensor => sensor.LastSeenAt)
            .ToList();
    }

    public async Task<IReadOnlyList<CoverageConnectionResponse>> GetCoverageConnectionsAsync(
        int hours,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying coverage connections over {Hours} hours", hours);

        var since = DateTimeOffset.UtcNow.AddHours(-hours);

        var readings = await db.GatewayReadings
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return readings
            .GroupBy(r => (r.GatewayUniqueId, r.SensorUniqueId))
            .Select(g =>
            {
                var recent = g.Where(r => r.ReceivedAt >= since && r.Rssi.HasValue).ToList();
                return new CoverageConnectionResponse(
                    g.Key.GatewayUniqueId,
                    g.Key.SensorUniqueId,
                    recent.Count > 0 ? recent.Average(r => (double)r.Rssi!.Value) : null,
                    g.Count(),
                    g.Max(r => r.ReceivedAt));
            })
            .OrderBy(c => c.GatewayId)
            .ThenBy(c => c.SensorId)
            .ToList();
    }

    public async Task<IReadOnlyList<string>> GetDistinctSensorTypesAsync(
        IReadOnlyList<string>? sensorIds = null,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying distinct sensor types");

        var query = db.SensorReadings.AsNoTracking();

        if (sensorIds is { Count: > 0 })
        {
            var idSet = sensorIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
            query = query.Where(r => idSet.Contains(r.SensorId));
        }

        return await query
            .Select(r => r.SensorType)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SensorReadingResponse>> ExportAsync(
        IReadOnlyList<string>? sensorIds,
        IReadOnlyList<string>? sensorTypes,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Exporting sensor readings from {From} to {To}", from, to);

        var query = db.SensorReadings
            .AsNoTracking()
            .Where(r => r.Timestamp >= from && r.Timestamp <= to);

        if (sensorIds is { Count: > 0 })
        {
            var idSet = sensorIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
            query = query.Where(r => idSet.Contains(r.SensorId));
        }

        if (sensorTypes is { Count: > 0 })
        {
            var typeSet = sensorTypes.ToHashSet(StringComparer.OrdinalIgnoreCase);
            query = query.Where(r => typeSet.Contains(r.SensorType));
        }

        return await query
            .OrderBy(r => r.SensorId)
            .ThenBy(r => r.Timestamp)
            .Select(r => new SensorReadingResponse(
                r.SensorId,
                r.SensorType,
                r.Value,
                r.Timestamp,
                r.GatewayId,
                r.Rssi))
            .ToListAsync(cancellationToken);
    }
}
