using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Buildings.Query;

public class BuildingsQueryHandler(DatabaseContext db, ILogger<BuildingsQueryHandler> logger)
{
    public async Task<IReadOnlyList<BuildingResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying all buildings");

        return await db.Buildings
            .AsNoTracking()
            .OrderBy(b => b.Name)
            .Select(b => new BuildingResponse(
                b.Id,
                b.Name,
                b.Address,
                b.Latitude,
                b.Longitude,
                b.IfcFileName,
                b.Devices.Count(d => !d.IsDeleted && d.Kind != DeviceKind.Gateway),
                b.LocationId,
                b.Location != null ? b.Location.Name : null,
                b.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<BuildingResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying building {BuildingId}", id);

        return await db.Buildings
            .AsNoTracking()
            .Where(b => b.Id == id)
            .Select(b => new BuildingResponse(
                b.Id,
                b.Name,
                b.Address,
                b.Latitude,
                b.Longitude,
                b.IfcFileName,
                b.Devices.Count(d => !d.IsDeleted && d.Kind != DeviceKind.Gateway),
                b.LocationId,
                b.Location != null ? b.Location.Name : null,
                b.CreatedAtUtc))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
