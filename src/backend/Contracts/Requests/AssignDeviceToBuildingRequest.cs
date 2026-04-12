namespace Contracts.Requests;

public record AssignDeviceToBuildingRequest(
    Guid DeviceId,
    Guid BuildingId,
    double? BimX,
    double? BimY,
    double? BimZ);
