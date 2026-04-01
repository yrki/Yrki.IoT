namespace Core.Models;

public class GatewayReading
{
    public Guid Id { get; set; }
    public required string GatewayUniqueId { get; set; }
    public required string SensorUniqueId { get; set; }
    public int? Rssi { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
}
