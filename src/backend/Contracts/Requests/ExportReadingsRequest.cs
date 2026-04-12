namespace Contracts.Requests;

public record ExportReadingsRequest(
    IReadOnlyList<string>? SensorIds,
    IReadOnlyList<string>? SensorTypes,
    DateTimeOffset From,
    DateTimeOffset To);
