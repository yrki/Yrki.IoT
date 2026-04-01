namespace service.Configuration;

public class MqttOptions
{
    public bool Enabled { get; set; }
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 1883;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string Topic { get; set; } = "wmbus/raw";
    public string ClientId { get; set; } = "yrki-iot-service";
}
