namespace service.Configuration;

public class WMBusOptions
{
    public string SerialPort { get; set; } = "/dev/ttyUSB0";
    public int BaudRate { get; set; } = 9600;

    // Keyed by device AField (e.g. "1A2B3C4D"), value is hex-encoded AES-128 key
    public Dictionary<string, string> DeviceKeys { get; set; } = new();
}
