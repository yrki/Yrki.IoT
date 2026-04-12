namespace Simulator.GeoAware;

public sealed record SimulatedGeoSensor(
    string SensorId,
    double Latitude,
    double Longitude,
    string Address,
    IReadOnlyList<GatewayLink> ReachableGateways);

public sealed record GatewayLink(
    string GatewayId,
    double DistanceMeters);
