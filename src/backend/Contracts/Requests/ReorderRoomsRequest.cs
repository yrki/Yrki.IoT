namespace Contracts.Requests;

public record ReorderRoomsRequest(IReadOnlyList<Guid> RoomIds);
