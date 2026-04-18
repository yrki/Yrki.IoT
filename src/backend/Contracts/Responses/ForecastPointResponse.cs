namespace Contracts.Responses;

public record ForecastPointResponse(
    DateTimeOffset Timestamp,
    decimal Value,
    decimal Lower,
    decimal Upper);
