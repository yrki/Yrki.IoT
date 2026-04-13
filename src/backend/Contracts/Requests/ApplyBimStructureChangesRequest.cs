namespace Contracts.Requests;

public record ApplyBimStructureChangesRequest(
    IReadOnlyList<Guid> FloorsToCreate,
    IReadOnlyList<Guid> FloorsToDelete,
    IReadOnlyList<Guid> RoomsToCreate,
    IReadOnlyList<Guid> RoomsToDelete);
