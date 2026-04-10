using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using EasyNetQ;
using Microsoft.EntityFrameworkCore;

namespace Simulator;

public class WaterMeterSimulatorWorker(
    IBus bus,
    IServiceScopeFactory scopeFactory,
    ILogger<WaterMeterSimulatorWorker> logger) : BackgroundService
{
    private const int IntervalSeconds = 5;
    private const int SimulatedMeterCount = 1000;
    private const int BatchSize = 100;
    private readonly List<SimulatedWaterMeter> _meters = [];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await LoadMetersAsync(stoppingToken);

        if (_meters.Count == 0)
        {
            logger.LogWarning("Water meter simulator found no matching 99* ColdWater devices.");
            return;
        }

        logger.LogInformation(
            "Water meter simulator started for {Count} devices, batch size {BatchSize}, interval {Interval}s",
            _meters.Count, BatchSize, IntervalSeconds);

        var batchStart = 0;
        var tick = 0;

        while (!stoppingToken.IsCancellationRequested)
        {
            var published = 0;
            var timestamp = DateTimeOffset.UtcNow;

            foreach (var meter in EnumerateBatch(batchStart))
            {
                foreach (var reading in WaterMeterReadingGenerator.CreateReadings(meter, timestamp, tick))
                {
                    await bus.PubSub.PublishAsync(reading, stoppingToken);
                    published++;
                }
            }

            logger.LogInformation(
                "Published {ReadingCount} water meter readings for batch starting at {BatchStart}",
                published, batchStart);

            batchStart = (batchStart + BatchSize) % _meters.Count;
            tick++;
            await Task.Delay(TimeSpan.FromSeconds(IntervalSeconds), stoppingToken);
        }
    }

    private async Task LoadMetersAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DatabaseContext>();

        var gatewayIds = await db.Devices
            .Where(device => device.Kind == DeviceKind.Gateway && !device.IsDeleted)
            .OrderBy(device => device.UniqueId)
            .Select(device => device.UniqueId)
            .ToListAsync(cancellationToken);

        var selectedMeters = await db.Devices
            .Where(device => EF.Functions.Like(device.UniqueId, "99%")
                && device.Type == "ColdWater"
                && device.Kind == DeviceKind.Sensor
                && !device.IsDeleted)
            .OrderBy(device => device.UniqueId)
            .Take(SimulatedMeterCount)
            .Select(device => new
            {
                device.UniqueId,
                device.LastContact,
            })
            .ToListAsync(cancellationToken);

        _meters.Clear();

        for (var index = 0; index < selectedMeters.Count; index++)
        {
            var meter = selectedMeters[index];
            var seed = GetSeed(meter.UniqueId);
            var baseVolume = Math.Round(250m + (seed % 160000) / 100m, 3, MidpointRounding.AwayFromZero);
            var lastContactOffset = meter.LastContact == default
                ? 0m
                : Math.Round((decimal)(DateTimeOffset.UtcNow - meter.LastContact).TotalHours * 0.0025m, 3, MidpointRounding.AwayFromZero);

            _meters.Add(new SimulatedWaterMeter
            {
                SensorId = meter.UniqueId,
                GatewayId = gatewayIds.Count == 0 ? null : gatewayIds[index % gatewayIds.Count],
                TotalVolume = baseVolume + Math.Max(0m, lastContactOffset),
                NegativeVolume = Math.Round(((seed / 7) % 350) / 1000m, 3, MidpointRounding.AwayFromZero),
                FlowBase = 20 + (seed % 260),
                FlowVariance = 40 + ((seed / 17) % 600),
                BurstEvery = 4 + (seed % 6),
                BurstOffset = seed % 5,
            });
        }
    }

    private IEnumerable<SimulatedWaterMeter> EnumerateBatch(int batchStart)
    {
        for (var offset = 0; offset < Math.Min(BatchSize, _meters.Count); offset++)
        {
            yield return _meters[(batchStart + offset) % _meters.Count];
        }
    }

    private static int GetSeed(string sensorId)
    {
        return Math.Abs(sensorId.Aggregate(17, (current, ch) => unchecked(current * 31 + ch)));
    }
}
