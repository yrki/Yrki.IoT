namespace Simulator.GeoAware;

public static class DistanceCalculator
{
    private const double EarthRadiusMeters = 6_371_000;
    private const double MaxRangeMeters = 2_000;
    private const int RssiAtZero = -40;
    private const int RssiAtMaxRange = -110;

    public static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2))
                  * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return EarthRadiusMeters * c;
    }

    public static bool IsInRange(double distanceMeters) => distanceMeters <= MaxRangeMeters;

    public static int CalculateRssi(double distanceMeters, Random random)
    {
        var clamped = Math.Clamp(distanceMeters, 0, MaxRangeMeters);
        var ratio = clamped / MaxRangeMeters;
        var baseRssi = (int)Math.Round(RssiAtZero + ratio * (RssiAtMaxRange - RssiAtZero));
        return baseRssi + random.Next(-5, 6);
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
}
