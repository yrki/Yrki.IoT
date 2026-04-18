using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.Extensions.Logging;

namespace Core.Features.Buildings.Command;

public class CreateBuildingCommandHandler(DatabaseContext db, ILogger<CreateBuildingCommandHandler> logger)
{
    public async Task<BuildingResponse> HandleAsync(
        CreateBuildingRequest request,
        CancellationToken cancellationToken = default)
    {
        var building = new Building
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Address = request.Address,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            LocationId = request.LocationId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        db.Buildings.Add(building);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Created building {BuildingName} with id {BuildingId}", building.Name, building.Id);
        return new BuildingResponse(
            building.Id, building.Name, building.Address,
            building.Latitude, building.Longitude, building.IfcFileName,
            0, building.LocationId, null, building.CreatedAtUtc);
    }
}
