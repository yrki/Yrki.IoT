using Contracts.Readings;
using MassTransit;

namespace Simulator;

public class MultiDeviceSimulatorWorker(IBus bus, ILogger<MultiDeviceSimulatorWorker> logger) : BackgroundService
{
    private const int IntervalSeconds = 1;
    private const int CycleSteps = 240; // ~60 min cycle at 15s interval

    private static readonly SimulatedDevice[] Devices =
    [
        new("LSN-67000100", "Lansen",
        [
            new("CO2", "ppm", 400, 1600, 0.0),
            new("Temperature", "°C", 20.0, 25.0, 0.5),
            new("Humidity", "%", 35.0, 65.0, 1.0),
            new("Sound", "dB", 30, 55, 1.5),
        ]),
        new("ELV-A2010034", "Elvaco",
        [
            new("Temperature", "°C", 18.0, 22.0, 0.3),
            new("Humidity", "%", 40.0, 70.0, 0.8),
        ]),
        new("KAM-30291877", "Kamstrup",
        [
            new("Temperature", "°C", 45.0, 65.0, 0.0),
            new("Flow", "l/h", 100, 800, 0.4),
        ]),
        new("AXI-00845512", "Axioma",
        [
            new("Volume", "m³", 0, 50, 0.0),
            new("Flow", "l/h", 0, 300, 0.6),
        ]),
        new("LSN-67000205", "Lansen",
        [
            new("CO2", "ppm", 500, 1200, 0.2),
            new("Temperature", "°C", 19.0, 24.0, 0.7),
            new("Humidity", "%", 30.0, 60.0, 1.2),
            new("Sound", "dB", 25, 45, 1.8),
        ]),
    ];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation(
            "Multi-device simulator started — {Count} devices, {Interval}s interval, ~{Period} min cycle",
            Devices.Length, IntervalSeconds, CycleSteps * IntervalSeconds / 60);

        var step = 0;

        while (!stoppingToken.IsCancellationRequested)
        {
            foreach (var device in Devices)
            {
                foreach (var sensor in device.Sensors)
                {
                    var value = SineValue(step, CycleSteps, sensor.Min, sensor.Max, sensor.Phase);
                    var reading = new SensorReadingReceived(
                        device.SensorId,
                        sensor.SensorType,
                        device.Manufacturer,
                        (decimal)Math.Round(value, 2),
                        DateTimeOffset.UtcNow);

                    await bus.Publish(reading, stoppingToken);
                }

                logger.LogInformation("Published readings for {SensorId} ({Manufacturer})",
                    device.SensorId, device.Manufacturer);
            }

            step++;
            await Task.Delay(TimeSpan.FromSeconds(IntervalSeconds), stoppingToken);
        }
    }

    private static double SineValue(int step, int period, double lo, double hi, double phase = 0.0)
    {
        var t = (double)(step % period) / period;
        return lo + (hi - lo) * 0.5 * (1.0 + Math.Sin(2 * Math.PI * t + phase));
    }
}
