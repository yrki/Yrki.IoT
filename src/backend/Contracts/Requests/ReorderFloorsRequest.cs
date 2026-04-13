namespace Contracts.Requests;

public record ReorderFloorsRequest(IReadOnlyList<Guid> FloorIds);
