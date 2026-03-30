using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Sensors.Command;

public class DeleteSensorCommandHandler(DatabaseContext db)
{
    public async Task<bool> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (device is null)
            return false;

        device.IsDeleted = true;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
