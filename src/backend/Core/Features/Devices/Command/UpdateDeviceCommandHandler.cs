using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Devices.Command;

public class UpdateDeviceCommandHandler(DatabaseContext db)
{
    public async Task<NewDeviceResponse?> HandleAsync(
        Guid id,
        UpdateDeviceRequest request,
        CancellationToken cancellationToken = default)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (device is null)
            return null;

        device.Name = request.Name ?? device.Name;
        device.Description = request.Description ?? device.Description;
        device.LocationId = request.LocationId ?? device.LocationId;
        device.IsNew = false;

        await db.SaveChangesAsync(cancellationToken);

        return new NewDeviceResponse(
            device.Id,
            device.UniqueId,
            device.Name,
            device.Manufacturer,
            device.Type.ToString(),
            device.Description,
            device.LocationId,
            device.LastContact,
            device.InstallationDate);
    }
}
