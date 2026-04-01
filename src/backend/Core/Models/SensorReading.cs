namespace Core.Models;

public class SensorReading
{
    public DateTimeOffset Timestamp { get; set; }
    public required string SensorId { get; set; }
    public required string SensorType { get; set; }
    public string? Manufacturer { get; set; }
    public string? GatewayId { get; set; }
    public int? Rssi { get; set; }
    public decimal Value { get; set; }
}
