namespace Core.Models;

public class RawPayload
{
    public Guid Id { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
    public required string PayloadHex { get; set; }
    public required string Source { get; set; }
    public string? DeviceId { get; set; }
    public string? Manufacturer { get; set; }
    public string? GatewayId { get; set; }
    public int? Rssi { get; set; }
    public string? Error { get; set; }
}
