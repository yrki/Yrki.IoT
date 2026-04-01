using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.SensorData.Query;

public class SensorReadingsQueryHandler(DatabaseContext db)
{
    public async Task<IReadOnlyList<SensorReadingResponse>> HandleAsync(
        SensorReadingQuery query,
        CancellationToken cancellationToken = default)
    {
        var since = DateTimeOffset.UtcNow.AddHours(-query.Hours);

        return await db.SensorReadings
            .AsNoTracking()
            .Where(r => r.SensorId == query.SensorId && r.Timestamp >= since)
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
        return await db.SensorReadings
            .AsNoTracking()
            .Select(r => r.SensorId)
            .Distinct()
            .OrderBy(id => id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SensorGatewayResponse>> GetGatewayStatisticsAsync(
        string sensorId,
        CancellationToken cancellationToken = default)
    {
        var readings = await db.GatewayReadings
            .AsNoTracking()
            .Where(reading => reading.SensorUniqueId == sensorId)
            .ToListAsync(cancellationToken);

        return readings
            .GroupBy(reading => reading.GatewayUniqueId)
            .Select(group => new SensorGatewayResponse(
                group.Key,
                group.Count(),
                group.Where(reading => reading.Rssi.HasValue).Average(reading => (decimal?)reading.Rssi) ?? 0m,
                group.Max(reading => reading.ReceivedAt)))
            .OrderByDescending(gateway => gateway.LastSeenAt)
            .ToList();
    }

    public async Task<IReadOnlyList<GatewaySensorResponse>> GetSensorStatisticsForGatewayAsync(
        string gatewayId,
        CancellationToken cancellationToken = default)
    {
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
}
