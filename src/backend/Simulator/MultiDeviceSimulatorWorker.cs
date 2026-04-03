using Contracts.Readings;
using EasyNetQ;

namespace Simulator;

public class MultiDeviceSimulatorWorker(IBus bus, ILogger<MultiDeviceSimulatorWorker> logger) : BackgroundService
{
    private const int IntervalSeconds = 1;
    private const int CycleSteps = 240;

    private static readonly SimulatedDevice[] Devices =
    [
        new("67000100", 20.0, 25.0, 35.0, 65.0, 400, 1600, 30, 55, 0.5, 1.0, 0.0, 1.5),
        new("67000101", 18.0, 22.0, 40.0, 70.0, 450, 1100, 25, 40, 0.3, 0.8, 0.2, 1.0),
        new("67000102", 21.0, 26.0, 30.0, 58.0, 550, 1300, 28, 48, 0.1, 1.3, 0.6, 0.9),
        new("67000103", 19.0, 24.0, 42.0, 68.0, 500, 1200, 32, 50, 0.7, 1.1, 0.4, 1.7),
        new("67000104", 17.5, 23.5, 38.0, 62.0, 420, 980, 27, 37, 0.9, 0.4, 0.8, 0.5),
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
                var frame = LansenFrameBuilder.Build(
                    device.AddressHex,
                    seq: step & 0xFF,
                    tempC: SineValue(step, CycleSteps, device.TemperatureMin, device.TemperatureMax, device.TemperaturePhase),
                    humidityPct: SineValue(step, CycleSteps, device.HumidityMin, device.HumidityMax, device.HumidityPhase),
                    co2Ppm: (int)Math.Round(SineValue(step, CycleSteps, device.Co2Min, device.Co2Max, device.Co2Phase)),
                    soundDb: (int)Math.Round(SineValue(step, CycleSteps, device.SoundMin, device.SoundMax, device.SoundPhase)));

                var payload = new SensorPayload(Convert.ToHexString(frame), DateTimeOffset.UtcNow);
                await bus.PubSub.PublishAsync(payload, stoppingToken);

                logger.LogInformation("Published WMBus payload for {AddressHex}", device.AddressHex);
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
