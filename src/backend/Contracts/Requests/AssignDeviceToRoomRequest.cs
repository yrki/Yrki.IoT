namespace Contracts.Requests;

public record AssignDeviceToRoomRequest(
    Guid DeviceId,
    Guid RoomId,
    double? BimX = null,
    double? BimY = null,
    double? BimZ = null);
