namespace Contracts.Requests;

public record ImportDeviceEntry(
    string UniqueId,
    string? Name,
    string? Manufacturer,
    string? Type,
    string? Kind,
    double? Latitude,
    double? Longitude,
    string? LocationName);

public record ImportDevicesRequest(
    IReadOnlyList<ImportDeviceEntry> Devices,
    string Mode);

public record ImportDevicesResponse(
    int Inserted,
    int Updated,
    int Deleted);
