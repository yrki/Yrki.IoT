using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Features.Locations.Query;
using Core.Models;

namespace Core.Features.Locations.Command;

public class CreateLocationCommandHandler(DatabaseContext db)
{
    public async Task<LocationResponse> HandleAsync(
        CreateLocationRequest request,
        CancellationToken cancellationToken = default)
    {
        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description ?? string.Empty,
            ParentLocationId = request.ParentLocationId,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Boundary = BoundarySerializer.Serialize(request.Boundary),
            Color = NormalizeColor(request.Color),
        };

        db.Locations.Add(location);
        await db.SaveChangesAsync(cancellationToken);

        return new LocationResponse(
            location.Id,
            location.Name,
            location.Description,
            0,
            location.ParentLocationId,
            location.Latitude,
            location.Longitude,
            request.Boundary,
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
