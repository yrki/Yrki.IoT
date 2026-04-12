using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Buildings.Command;

public class UpdateBuildingCommandHandler(DatabaseContext db)
{
    public async Task<BuildingResponse?> HandleAsync(
        Guid id,
        UpdateBuildingRequest request,
        CancellationToken cancellationToken = default)
    {
        var building = await db.Buildings
            .Include(b => b.Devices)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (building is null) return null;

        if (request.Name is not null) building.Name = request.Name;
        if (request.Address is not null) building.Address = request.Address;
        if (request.Latitude is not null) building.Latitude = request.Latitude;
        if (request.Longitude is not null) building.Longitude = request.Longitude;

        await db.SaveChangesAsync(cancellationToken);

        return new BuildingResponse(
            building.Id, building.Name, building.Address,
            building.Latitude, building.Longitude, building.IfcFileName,
            building.Devices.Count(d => !d.IsDeleted && d.Kind != DeviceKind.Gateway),
            building.CreatedAtUtc);
    }
}
