namespace Contracts.Requests;

public record CreateFloorRequest(string Name, double Elevation = 0);
