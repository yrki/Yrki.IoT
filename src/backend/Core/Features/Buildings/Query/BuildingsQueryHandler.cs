using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Buildings.Query;

public class BuildingsQueryHandler(DatabaseContext db)
{
    public async Task<IReadOnlyList<BuildingResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
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
                b.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<BuildingResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
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
                b.CreatedAtUtc))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
