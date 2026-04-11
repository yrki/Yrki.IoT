using System.Text.Json;
using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Locations.Query;

public class LocationsQueryHandler(DatabaseContext db)
{
    public async Task<IReadOnlyList<LocationResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
        var rows = await db.Locations
            .AsNoTracking()
            .OrderBy(l => l.Name)
            .Select(l => new
            {
                l.Id,
                l.Name,
                l.Description,
                DeviceCount = l.Devices.Count(d => !d.IsNew && !d.IsDeleted && d.Kind != DeviceKind.Gateway),
                l.ParentLocationId,
                l.Latitude,
                l.Longitude,
                l.Boundary,
                l.Color,
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(l => new LocationResponse(
                l.Id,
                l.Name,
                l.Description,
                l.DeviceCount,
                l.ParentLocationId,
                l.Latitude,
                l.Longitude,
                BoundarySerializer.Deserialize(l.Boundary),
                l.Color))
            .ToList();
    }
}

internal static class BoundarySerializer
{
    public static double[][]? Deserialize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        try
        {
            return JsonSerializer.Deserialize<double[][]>(raw);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static string? Serialize(double[][]? boundary)
    {
        if (boundary is null || boundary.Length == 0)
            return null;

        return JsonSerializer.Serialize(boundary);
    }
}
