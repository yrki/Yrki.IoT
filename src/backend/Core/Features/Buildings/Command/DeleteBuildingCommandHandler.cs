using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Buildings.Command;

public class DeleteBuildingCommandHandler(DatabaseContext db, ILogger<DeleteBuildingCommandHandler> logger)
{
    public async Task<bool> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var building = await db.Buildings.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (building is null)
        {
            logger.LogWarning("Building {BuildingId} not found", id);
            return false;
        }

        // Detach devices from building
        var devices = await db.Devices.Where(d => d.BuildingId == id).ToListAsync(cancellationToken);
        foreach (var device in devices)
        {
            device.BuildingId = null;
            device.BimX = null;
            device.BimY = null;
            device.BimZ = null;
        }

        db.Buildings.Remove(building);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Deleted building {BuildingId}", id);
        return true;
    }
}
