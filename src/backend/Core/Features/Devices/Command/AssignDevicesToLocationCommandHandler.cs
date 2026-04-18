using Contracts.Requests;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Devices.Command;

public class AssignDevicesToLocationCommandHandler(DatabaseContext db, ILogger<AssignDevicesToLocationCommandHandler> logger)
{
    public async Task<int> HandleAsync(
        AssignDevicesToLocationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.DeviceIds.Count == 0)
            return 0;

        var locationExists = await db.Locations
            .AnyAsync(l => l.Id == request.LocationId, cancellationToken);

        if (!locationExists)
        {
            logger.LogWarning("Location {LocationId} not found", request.LocationId);
            return -1;
        }

        var devices = await db.Devices
            .Where(d => request.DeviceIds.Contains(d.Id))
            .ToListAsync(cancellationToken);

        foreach (var device in devices)
            device.LocationId = request.LocationId;

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Assigned {Count} devices to location {LocationId}", devices.Count, request.LocationId);
        return devices.Count;
    }
}
