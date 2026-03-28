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
            .Where(r => r.Timestamp >= since)
            .OrderBy(r => r.Timestamp)
            .Select(r => new SensorReadingResponse(
                r.SensorId,
                r.SensorType,
                r.Value,
                r.Timestamp))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SensorReadingResponse>> HandleLatestAsync(
        CancellationToken cancellationToken = default)
    {
        var sensorTypes = await db.SensorReadings
            .AsNoTracking()
            .Select(r => r.SensorType)
            .Distinct()
            .ToListAsync(cancellationToken);

        var results = new List<SensorReadingResponse>();
        foreach (var type in sensorTypes)
        {
            var reading = await db.SensorReadings
                .AsNoTracking()
                .Where(r => r.SensorType == type)
                .OrderByDescending(r => r.Timestamp)
                .Select(r => new SensorReadingResponse(
                    r.SensorId,
                    r.SensorType,
                    r.Value,
                    r.Timestamp))
                .FirstOrDefaultAsync(cancellationToken);

            if (reading is not null)
                results.Add(reading);
        }

        return results;
    }
}
