using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Sensors.Query;

public class SensorsByLocationQueryHandler(DatabaseContext db, ILogger<SensorsByLocationQueryHandler> logger)
{
    private static readonly Guid UnknownLocationId = new("00000000-0000-0000-0000-000000000001");

    public async Task<IReadOnlyList<SensorListItemResponse>> HandleAsync(
        Guid locationId,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying sensors for location {LocationId}", locationId);

        return await db.Devices
            .AsNoTracking()
            .Where(d => !d.IsNew && !d.IsDeleted && d.LocationId == locationId)
            .Include(d => d.Location)
            .OrderBy(d => d.Kind)
            .ThenBy(d => d.Name)
            .ThenBy(d => d.UniqueId)
            .Select(d => new SensorListItemResponse(
                d.Id,
                d.UniqueId,
                d.Name,
                d.Manufacturer,
                d.Type,
                d.Kind.ToString(),
                d.LocationId == UnknownLocationId ? null : d.Location != null ? d.Location.Name : null,
                d.LocationId == UnknownLocationId ? null : d.LocationId,
                d.LastContact,
                d.InstallationDate,
                d.Latitude,
                d.Longitude))
            .ToListAsync(cancellationToken);
    }
}
