using Contracts.Requests;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Buildings.Command;

public class AssignDeviceToBuildingCommandHandler(DatabaseContext db, ILogger<AssignDeviceToBuildingCommandHandler> logger)
{
    public async Task<bool> HandleAsync(
        AssignDeviceToBuildingRequest request,
        CancellationToken cancellationToken = default)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == request.DeviceId, cancellationToken);
        if (device is null)
        {
            logger.LogWarning("Device {DeviceId} not found", request.DeviceId);
            return false;
        }

        var building = await db.Buildings.AnyAsync(b => b.Id == request.BuildingId, cancellationToken);
        if (!building)
        {
            logger.LogWarning("Building {BuildingId} not found", request.BuildingId);
            return false;
        }

        device.BuildingId = request.BuildingId;
        device.BimX = request.BimX;
        device.BimY = request.BimY;
        device.BimZ = request.BimZ;

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Assigned device {DeviceId} to building {BuildingId}", request.DeviceId, request.BuildingId);
        return true;
    }
}
