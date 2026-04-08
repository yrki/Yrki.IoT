using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Sensors.Query;

public class SensorByUniqueIdQueryHandler(DatabaseContext db)
{
    private static readonly Guid UnknownLocationId = new("00000000-0000-0000-0000-000000000001");

    public async Task<SensorListItemResponse?> HandleAsync(
        string sensorId,
        CancellationToken cancellationToken = default)
    {
        return await db.Devices
            .AsNoTracking()
            .Where(d => d.Kind == DeviceKind.Sensor && !d.IsNew && !d.IsDeleted && d.UniqueId == sensorId)
            .Include(d => d.Location)
            .OrderBy(d => d.Name)
            .ThenBy(d => d.UniqueId)
            .Select(d => new SensorListItemResponse(
                d.Id,
                d.UniqueId,
                d.Name,
                d.Manufacturer,
                d.Type,
                d.Kind.ToString(),
                d.LocationId == UnknownLocationId ? null : d.Location != null ? d.Location.Name : null,
                d.LocationId == UnknownLocationId ? null : d.LocationId,
                d.LastContact,
                d.InstallationDate,
                d.Latitude,
                d.Longitude))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
