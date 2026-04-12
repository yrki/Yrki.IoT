namespace Simulator.GeoAware;

public static class GatewayPlacementStrategy
{
    private const int DesiredGatewayCount = 7;
    private const double NeighborRadiusMeters = 800;
    private const double MinGatewaySpacingMeters = 1500;

    public static IReadOnlyList<AddressRecord> PickGatewayLocations(IReadOnlyList<AddressRecord> addresses)
    {
        var scored = addresses
            .Select(addr => new
            {
                Address = addr,
                Neighbors = addresses.Count(other =>
                    !ReferenceEquals(addr, other)
                    && DistanceCalculator.HaversineMeters(addr.Latitude, addr.Longitude, other.Latitude, other.Longitude)
                       <= NeighborRadiusMeters)
            })
            .OrderByDescending(x => x.Neighbors)
            .ToList();

        var selected = new List<AddressRecord>();

        foreach (var candidate in scored)
        {
            if (selected.Count >= DesiredGatewayCount)
                break;

            var tooClose = selected.Any(existing =>
                DistanceCalculator.HaversineMeters(
                    existing.Latitude, existing.Longitude,
                    candidate.Address.Latitude, candidate.Address.Longitude) < MinGatewaySpacingMeters);

            if (!tooClose)
                selected.Add(candidate.Address);
        }

        return selected;
    }
}
