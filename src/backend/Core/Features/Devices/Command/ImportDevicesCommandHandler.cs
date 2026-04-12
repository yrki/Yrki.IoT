using Contracts.Requests;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Devices.Command;

public class ImportDevicesCommandHandler(DatabaseContext db)
{
    public async Task<ImportDevicesResponse> HandleAsync(
        ImportDevicesRequest request,
        CancellationToken cancellationToken = default)
    {
        var isReplace = string.Equals(request.Mode, "replace", StringComparison.OrdinalIgnoreCase);

        var locations = await db.Locations
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var locationByName = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var location in locations)
        {
            locationByName.TryAdd(location.Name, location.Id);
        }

        var existingDevices = await db.Devices
            .Where(d => !d.IsDeleted)
            .ToListAsync(cancellationToken);

        var existingByUniqueId = existingDevices.ToDictionary(d => d.UniqueId, StringComparer.OrdinalIgnoreCase);
        var importedUniqueIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var inserted = 0;
        var updated = 0;

        foreach (var entry in request.Devices)
        {
            if (string.IsNullOrWhiteSpace(entry.UniqueId))
                continue;

            var uniqueId = entry.UniqueId.Trim();
            importedUniqueIds.Add(uniqueId);

            var kind = ParseKind(entry.Kind);
            Guid? locationId = null;
            if (!string.IsNullOrWhiteSpace(entry.LocationName) &&
                locationByName.TryGetValue(entry.LocationName.Trim(), out var locId))
            {
                locationId = locId;
            }

            if (existingByUniqueId.TryGetValue(uniqueId, out var existing))
            {
                if (!string.IsNullOrWhiteSpace(entry.Name))
                    existing.Name = entry.Name.Trim();
                if (!string.IsNullOrWhiteSpace(entry.Manufacturer))
                    existing.Manufacturer = entry.Manufacturer.Trim();
                if (!string.IsNullOrWhiteSpace(entry.Type))
                    existing.Type = entry.Type.Trim();
                if (kind.HasValue)
                    existing.Kind = kind.Value;
                if (entry.Latitude.HasValue)
                    existing.Latitude = entry.Latitude;
                if (entry.Longitude.HasValue)
                    existing.Longitude = entry.Longitude;
                if (locationId.HasValue)
                    existing.LocationId = locationId;

                existing.IsNew = false;
                updated++;
            }
            else
            {
                var device = new Device
                {
                    Id = Guid.NewGuid(),
                    UniqueId = uniqueId,
                    Name = entry.Name?.Trim() ?? uniqueId,
                    Manufacturer = entry.Manufacturer?.Trim(),
                    Type = entry.Type?.Trim() ?? "Unknown",
                    Description = string.Empty,
                    Kind = kind ?? DeviceKind.Sensor,
                    Latitude = entry.Latitude,
                    Longitude = entry.Longitude,
                    LocationId = locationId,
                    IsNew = false,
                    IsDeleted = false,
                    LastContact = DateTimeOffset.UtcNow,
                    InstallationDate = DateTimeOffset.UtcNow,
                };
                db.Devices.Add(device);
                inserted++;
            }
        }

        var deleted = 0;
        if (isReplace)
        {
            foreach (var existing in existingDevices)
            {
                if (!importedUniqueIds.Contains(existing.UniqueId))
                {
                    existing.IsDeleted = true;
                    deleted++;
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return new ImportDevicesResponse(inserted, updated, deleted);
    }

    private static DeviceKind? ParseKind(string? kind)
    {
        if (string.IsNullOrWhiteSpace(kind))
            return null;

        if (kind.Trim().Equals("Gateway", StringComparison.OrdinalIgnoreCase))
            return DeviceKind.Gateway;

        if (kind.Trim().Equals("Sensor", StringComparison.OrdinalIgnoreCase))
            return DeviceKind.Sensor;

        return null;
    }
}
