using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Locations.Command;

public class UpdateLocationCommandHandler(DatabaseContext db)
{
    public async Task<LocationResponse?> HandleAsync(
        Guid id,
        UpdateLocationRequest request,
        CancellationToken cancellationToken = default)
    {
        var location = await db.Locations
            .Include(l => l.Devices)
            .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);

        if (location is null)
            return null;

        location.Name = request.Name ?? location.Name;
        location.Description = request.Description ?? location.Description;

        if (request.ParentLocationId is not null)
            location.ParentLocationId = request.ParentLocationId == Guid.Empty ? null : request.ParentLocationId;

        await db.SaveChangesAsync(cancellationToken);

        return new LocationResponse(
            location.Id,
            location.Name,
            location.Description,
            location.Devices.Count(d => !d.IsNew),
            location.ParentLocationId);
    }
}
