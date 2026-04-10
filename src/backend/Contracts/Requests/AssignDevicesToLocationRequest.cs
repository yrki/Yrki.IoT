namespace Contracts.Requests;

public record AssignDevicesToLocationRequest(
    Guid LocationId,
    IReadOnlyList<Guid> DeviceIds);
