namespace Simulator;

public record SimulatedDevice(
    string SensorId,
    string Manufacturer,
    SimulatedSensor[] Sensors);

public record SimulatedSensor(
    string SensorType,
    string Unit,
    double Min,
    double Max,
    double Phase);
