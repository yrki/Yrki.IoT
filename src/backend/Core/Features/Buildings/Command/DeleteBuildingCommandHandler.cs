using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Buildings.Command;

public class DeleteBuildingCommandHandler(DatabaseContext db)
{
    public async Task<bool> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var building = await db.Buildings.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (building is null) return false;

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
        return true;
    }
}
