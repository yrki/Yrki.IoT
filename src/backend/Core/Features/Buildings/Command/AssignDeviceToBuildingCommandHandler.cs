using Contracts.Requests;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Buildings.Command;

public class AssignDeviceToBuildingCommandHandler(DatabaseContext db)
{
    public async Task<bool> HandleAsync(
        AssignDeviceToBuildingRequest request,
        CancellationToken cancellationToken = default)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == request.DeviceId, cancellationToken);
        if (device is null) return false;

        var building = await db.Buildings.AnyAsync(b => b.Id == request.BuildingId, cancellationToken);
        if (!building) return false;

        device.BuildingId = request.BuildingId;
        device.BimX = request.BimX;
        device.BimY = request.BimY;
        device.BimZ = request.BimZ;

        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
