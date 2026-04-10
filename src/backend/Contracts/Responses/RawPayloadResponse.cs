namespace Contracts.Responses;

public record RawPayloadResponse(
    Guid Id,
    DateTimeOffset ReceivedAt,
    string PayloadHex,
    string Source,
    string? DeviceId,
    string? Manufacturer,
    string? GatewayId,
    int? Rssi,
    string? Error);
