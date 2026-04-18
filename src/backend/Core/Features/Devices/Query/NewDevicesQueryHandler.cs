using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Devices.Query;

public class NewDevicesQueryHandler(DatabaseContext db, ILogger<NewDevicesQueryHandler> logger)
{
    public async Task<IReadOnlyList<NewDeviceResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying new devices");

        return await db.Devices
            .AsNoTracking()
            .Where(d => d.Kind == DeviceKind.Sensor && d.IsNew && !d.IsDeleted)
            .OrderByDescending(d => d.LastContact)
            .Select(d => new NewDeviceResponse(
                d.Id,
                d.UniqueId,
                d.Name,
                d.Manufacturer,
                d.Type,
                d.Description,
                d.LocationId,
                d.LastContact,
                d.InstallationDate,
                d.Latitude,
                d.Longitude))
            .ToListAsync(cancellationToken);
    }
}
