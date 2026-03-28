using Core.Contexts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class SensorReadingsController(DatabaseContext db) : ControllerBase
{
    [HttpGet("recent")]
    public async Task<IActionResult> GetRecent(
        [FromQuery] int hours = 3,
        CancellationToken cancellationToken = default)
    {
        var since = DateTimeOffset.UtcNow.AddHours(-hours);

        var readings = await db.SensorReadings
            .AsNoTracking()
            .Where(r => r.Timestamp >= since)
            .OrderBy(r => r.Timestamp)
            .Select(r => new
            {
                r.SensorId,
                r.SensorType,
                r.Value,
                r.Timestamp,
            })
            .ToListAsync(cancellationToken);

        return Ok(readings);
    }

    [HttpGet("latest")]
    public async Task<IActionResult> GetLatest(CancellationToken cancellationToken)
    {
        var sensorTypes = await db.SensorReadings
            .AsNoTracking()
            .Select(r => r.SensorType)
            .Distinct()
            .ToListAsync(cancellationToken);

        var latest = new List<object>();
        foreach (var type in sensorTypes)
        {
            var reading = await db.SensorReadings
                .AsNoTracking()
                .Where(r => r.SensorType == type)
                .OrderByDescending(r => r.Timestamp)
                .Select(r => new
                {
                    r.SensorId,
                    r.SensorType,
                    r.Value,
                    r.Timestamp,
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (reading is not null)
                latest.Add(reading);
        }

        return Ok(latest);
    }
}
