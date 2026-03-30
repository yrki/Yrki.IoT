using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
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
        };

        db.Locations.Add(location);
        await db.SaveChangesAsync(cancellationToken);

        return new LocationResponse(location.Id, location.Name, location.Description, 0, location.ParentLocationId);
    }
}
