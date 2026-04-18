using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Buildings.Command;

public class UpdateBuildingCommandHandler(DatabaseContext db, ILogger<UpdateBuildingCommandHandler> logger)
{
    public async Task<BuildingResponse?> HandleAsync(
        Guid id,
        UpdateBuildingRequest request,
        CancellationToken cancellationToken = default)
    {
        var building = await db.Buildings
            .Include(b => b.Devices)
            .Include(b => b.Location)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (building is null)
        {
            logger.LogWarning("Building {BuildingId} not found", id);
            return null;
        }

        if (request.Name is not null) building.Name = request.Name;
        if (request.Address is not null) building.Address = request.Address;
        if (request.Latitude is not null) building.Latitude = request.Latitude;
        if (request.Longitude is not null) building.Longitude = request.Longitude;
        if (request.LocationId is not null)
            building.LocationId = request.LocationId == Guid.Empty ? null : request.LocationId;

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Updated building {BuildingId}", id);
        return new BuildingResponse(
            building.Id, building.Name, building.Address,
            building.Latitude, building.Longitude, building.IfcFileName,
            building.Devices.Count(d => !d.IsDeleted && d.Kind != DeviceKind.Gateway),
            building.LocationId, building.Location?.Name,
            building.CreatedAtUtc);
    }
}
