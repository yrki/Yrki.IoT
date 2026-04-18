using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Features.Locations.Query;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Locations.Command;

public class UpdateLocationCommandHandler(DatabaseContext db, ILogger<UpdateLocationCommandHandler> logger)
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
        {
            logger.LogWarning("Location {LocationId} not found", id);
            return null;
        }

        location.Name = request.Name ?? location.Name;
        location.Description = request.Description ?? location.Description;

        if (request.ParentLocationId is not null)
            location.ParentLocationId = request.ParentLocationId == Guid.Empty ? null : request.ParentLocationId;

        if (request.Latitude is not null)
            location.Latitude = request.Latitude;

        if (request.Longitude is not null)
            location.Longitude = request.Longitude;

        if (request.Boundary is not null)
            location.Boundary = BoundarySerializer.Serialize(request.Boundary);

        if (request.Color is not null)
            location.Color = NormalizeColor(request.Color);

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Updated location {LocationId}", id);
        return new LocationResponse(
            location.Id,
            location.Name,
            location.Description,
            location.Devices.Count(d => !d.IsNew && d.Kind != DeviceKind.Gateway),
            location.ParentLocationId,
            location.Latitude,
            location.Longitude,
            BoundarySerializer.Deserialize(location.Boundary),
            location.Color);
    }

    private static string? NormalizeColor(string? color)
    {
        if (string.IsNullOrWhiteSpace(color))
            return null;
        var trimmed = color.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }
}
