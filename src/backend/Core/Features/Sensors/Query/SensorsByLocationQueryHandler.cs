using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Sensors.Query;

public class SensorsByLocationQueryHandler(DatabaseContext db)
{
    private static readonly Guid UnknownLocationId = new("00000000-0000-0000-0000-000000000001");

    public async Task<IReadOnlyList<SensorListItemResponse>> HandleAsync(
        Guid locationId,
        CancellationToken cancellationToken = default)
    {
        return await db.Devices
            .AsNoTracking()
            .Where(d => !d.IsNew && !d.IsDeleted && d.LocationId == locationId)
            .Include(d => d.Location)
            .OrderBy(d => d.Name)
            .ThenBy(d => d.UniqueId)
            .Select(d => new SensorListItemResponse(
                d.Id,
                d.UniqueId,
                d.Name,
                d.Manufacturer,
                d.Type,
                d.LocationId == UnknownLocationId ? null : d.Location != null ? d.Location.Name : null,
                d.LocationId == UnknownLocationId ? null : d.LocationId,
                d.LastContact,
                d.InstallationDate))
            .ToListAsync(cancellationToken);
    }
}
