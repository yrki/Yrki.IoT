using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Devices.Query;

public class NewDevicesQueryHandler(DatabaseContext db)
{
    public async Task<IReadOnlyList<NewDeviceResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
        return await db.Devices
            .AsNoTracking()
            .Where(d => d.IsNew && !d.IsDeleted)
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
                d.InstallationDate))
            .ToListAsync(cancellationToken);
    }
}
