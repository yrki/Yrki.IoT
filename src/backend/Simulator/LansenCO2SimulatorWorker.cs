using Contracts.Readings;
using MassTransit;

namespace Simulator;

public class LansenCO2SimulatorWorker(IBus bus, ILogger<LansenCO2SimulatorWorker> logger) : BackgroundService
{
    private const int CycleSteps = 30;
    private const int IntervalSeconds = 20;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Lansen CO2 simulator started — CO2 800-1600 ppm, {Interval}s interval, ~{Period} min cycle",
            IntervalSeconds, CycleSteps * IntervalSeconds / 60);

        var step = 0;
        var seq = 0;

        while (!stoppingToken.IsCancellationRequested)
        {
            var co2 = (int)Math.Round(SineValue(step, CycleSteps, 800, 1600));
            var temp = SineValue(step, CycleSteps, 21.0, 23.0, phase: 0.5);
            var humidity = SineValue(step, CycleSteps, 45.0, 55.0, phase: 1.0);

            var frame = LansenFrameBuilder.Build(seq, temp, humidity, co2);
            var payload = new SensorPayload(frame, DateTimeOffset.UtcNow);

            await bus.Publish(payload, stoppingToken);

            logger.LogInformation("seq={Seq:D3}  CO2={CO2:D4} ppm  Temp={Temp:F1}C  Hum={Hum:F1}%",
                seq, co2, temp, humidity);

            step++;
            seq = (seq + 1) & 0xFF;

            await Task.Delay(TimeSpan.FromSeconds(IntervalSeconds), stoppingToken);
        }
    }

    private static double SineValue(int step, int period, double lo, double hi, double phase = 0.0)
    {
        var t = (double)(step % period) / period;
        return lo + (hi - lo) * 0.5 * (1.0 + Math.Sin(2 * Math.PI * t + phase));
    }
}
