using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Devices.Command;

public class UpdateDeviceCommandHandler(DatabaseContext db, ILogger<UpdateDeviceCommandHandler> logger)
{
    public async Task<NewDeviceResponse?> HandleAsync(
        Guid id,
        UpdateDeviceRequest request,
        CancellationToken cancellationToken = default)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (device is null)
        {
            logger.LogWarning("Device {DeviceId} not found", id);
            return null;
        }

        device.Name = request.Name ?? device.Name;
        device.Description = request.Description ?? device.Description;
        device.LocationId = request.LocationId ?? device.LocationId;
        device.IsNew = false;

        if (request.Latitude is not null)
            device.Latitude = request.Latitude;

        if (request.Longitude is not null)
            device.Longitude = request.Longitude;

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Updated device {DeviceId}", id);
        return new NewDeviceResponse(
            device.Id,
            device.UniqueId,
            device.Name,
            device.Manufacturer,
            device.Type.ToString(),
            device.Description,
            device.LocationId,
            device.LastContact,
            device.InstallationDate,
            device.Latitude,
            device.Longitude);
    }
}
