namespace Simulator.GeoAware;

public sealed record AddressRecord(
    string Address,
    string PostalCode,
    string PostalLocality,
    double Latitude,
    double Longitude);
