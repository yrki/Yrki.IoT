using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Devices.Command;

public class CreateDeviceCommandHandler(DatabaseContext db)
{
    public async Task<SensorListItemResponse?> HandleAsync(
        CreateDeviceRequest request,
        CancellationToken cancellationToken = default)
    {
        var existing = await db.Devices.FirstOrDefaultAsync(
            d => d.UniqueId == request.UniqueId && !d.IsDeleted, cancellationToken);
        if (existing is not null)
            return null; // already exists

        var device = new Device
        {
            Id = Guid.NewGuid(),
            UniqueId = request.UniqueId.Trim(),
            Manufacturer = request.Manufacturer.Trim(),
            Name = request.Name?.Trim(),
            Type = request.Type?.Trim() ?? "Unknown",
            Description = string.Empty,
            Kind = DeviceKind.Sensor,
            IsNew = false,
            IsDeleted = false,
            LastContact = DateTimeOffset.UtcNow,
            InstallationDate = DateTimeOffset.UtcNow,
        };

        db.Devices.Add(device);
        await db.SaveChangesAsync(cancellationToken);

        return new SensorListItemResponse(
            device.Id, device.UniqueId, device.Name, device.Manufacturer,
            device.Type, device.Kind.ToString(), null, null,
            device.LastContact, device.InstallationDate,
            device.Latitude, device.Longitude);
    }
}
