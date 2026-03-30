namespace Contracts.Requests;

public record CreateLocationRequest(string Name, string? Description, Guid? ParentLocationId);
