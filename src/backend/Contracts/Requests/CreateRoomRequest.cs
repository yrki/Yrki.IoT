namespace Contracts.Requests;

public record CreateRoomRequest(string Name, string? Number = null);
