using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Locations.Query;

public class LocationsQueryHandler(DatabaseContext db)
{
    public async Task<IReadOnlyList<LocationResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
        return await db.Locations
            .AsNoTracking()
            .OrderBy(l => l.Name)
            .Select(l => new LocationResponse(
                l.Id,
                l.Name,
                l.Description,
                l.Devices.Count(d => !d.IsNew && !d.IsDeleted),
                l.ParentLocationId,
                l.Latitude,
                l.Longitude))
            .ToListAsync(cancellationToken);
    }
}
