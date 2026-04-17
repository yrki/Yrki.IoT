using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using EasyNetQ;
using Microsoft.EntityFrameworkCore;

namespace Simulator.GeoAware;

public sealed class GeoAwareSimulatorWorker(
    IBus bus,
    IServiceScopeFactory scopeFactory,
    ILogger<GeoAwareSimulatorWorker> logger) : BackgroundService
{
    private const int IntervalSeconds = 10;
    private const int BatchSize = 50;
    private readonly Random _random = new();
    private readonly List<SimulatedGeoSensor> _sensors = [];
    private readonly Dictionary<string, decimal> _accumulatedVolume = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait for seeder to finish
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        await LoadSensorsAsync(stoppingToken);

        if (_sensors.Count == 0)
        {
            logger.LogWarning("Geo-aware simulator found no SIM* sensors with gateway links.");
            return;
        }

        var sensorsWithGateways = _sensors.Count(s => s.ReachableGateways.Count > 0);
        var sensorsWithout = _sensors.Count - sensorsWithGateways;
        var multiGateway = _sensors.Count(s => s.ReachableGateways.Count > 1);
        var totalLinks = _sensors.Sum(s => s.ReachableGateways.Count);

        logger.LogInformation(
            "Geo-aware simulator started: {Total} sensors, {WithGw} with gateways ({Multi} multi-gateway), {Without} unreachable, {Links} total sensor-gateway links, interval {Interval}s",
            _sensors.Count, sensorsWithGateways, multiGateway, sensorsWithout, totalLinks, IntervalSeconds);

        var batchStart = 0;
        var tick = 0;

        while (!stoppingToken.IsCancellationRequested)
        {
            var published = 0;
            var timestamp = DateTimeOffset.UtcNow;

            for (var offset = 0; offset < Math.Min(BatchSize, _sensors.Count); offset++)
            {
                var sensor = _sensors[(batchStart + offset) % _sensors.Count];

                if (sensor.ReachableGateways.Count == 0)
                    continue;

                // Compute volume once per sensor per tick so all gateways report the same value
                var readings = CreateWaterMeterReadings(sensor, _accumulatedVolume, timestamp, tick);

                // Each gateway in range picks up the sensor signal independently
                foreach (var gateway in sensor.ReachableGateways)
                {
                    var rssi = DistanceCalculator.CalculateRssi(gateway.DistanceMeters, _random);

                    foreach (var reading in readings)
                    {
                        var gatewayReading = reading with { GatewayId = gateway.GatewayId, Rssi = rssi };
                        await bus.PubSub.PublishAsync(gatewayReading, stoppingToken);
                        published++;
                    }
                }
            }

            if (published > 0)
            {
                logger.LogInformation(
                    "Published {Count} geo-aware readings for batch at {BatchStart}",
                    published, batchStart);
            }

            batchStart = (batchStart + BatchSize) % _sensors.Count;
            tick++;
            await Task.Delay(TimeSpan.FromSeconds(IntervalSeconds), stoppingToken);
        }
    }

    private async Task LoadSensorsAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DatabaseContext>();

        var gateways = await db.Devices
            .Where(d => d.UniqueId.StartsWith("SIMGW") && d.Kind == DeviceKind.Gateway && !d.IsDeleted)
            .Select(d => new { d.UniqueId, d.Latitude, d.Longitude })
            .ToListAsync(cancellationToken);

        logger.LogInformation("Loaded {Count} SIMGW gateways from database.", gateways.Count);
        foreach (var gw in gateways)
        {
            logger.LogInformation("  Gateway {Id}: lat={Lat}, lon={Lon}",
                gw.UniqueId, gw.Latitude, gw.Longitude);
        }

        var sensors = await db.Devices
            .Where(d => d.UniqueId.StartsWith("SIM") && !d.UniqueId.StartsWith("SIMGW")
                        && d.Kind == DeviceKind.Sensor && !d.IsDeleted)
            .Select(d => new { d.UniqueId, d.Latitude, d.Longitude, d.Description })
            .ToListAsync(cancellationToken);

        logger.LogInformation("Loaded {Count} SIM sensors from database.", sensors.Count);

        foreach (var sensor in sensors)
        {
            if (sensor.Latitude is null || sensor.Longitude is null)
                continue;

            var links = new List<GatewayLink>();

            foreach (var gw in gateways)
            {
                if (gw.Latitude is null || gw.Longitude is null)
                    continue;

                var distance = DistanceCalculator.HaversineMeters(
                    sensor.Latitude.Value, sensor.Longitude.Value,
                    gw.Latitude.Value, gw.Longitude.Value);

                if (DistanceCalculator.IsInRange(distance))
                    links.Add(new GatewayLink(gw.UniqueId, distance));
            }

            links.Sort((a, b) => a.DistanceMeters.CompareTo(b.DistanceMeters));

            _sensors.Add(new SimulatedGeoSensor(
                sensor.UniqueId,
                sensor.Latitude.Value,
                sensor.Longitude.Value,
                sensor.Description,
                links));
        }
    }

    private static IReadOnlyList<SensorReadingReceived> CreateWaterMeterReadings(
        SimulatedGeoSensor sensor,
        Dictionary<string, decimal> accumulatedVolume,
        DateTimeOffset timestamp,
        int tick)
    {
        var seed = Math.Abs(sensor.SensorId.Aggregate(17, (current, ch) => unchecked(current * 31 + ch)));
        var baseVolume = 250m + (seed % 160000) / 100m;
        var flowBase = 20 + (seed % 260);
        var flowVariance = 40 + ((seed / 17) % 600);
        var burstEvery = 4 + (seed % 6);

        var flow = flowBase + (tick % 5) * (flowVariance / 6m);
        if (tick % burstEvery == 0)
            flow += flowVariance;
        flow = Math.Round(flow, 3, MidpointRounding.AwayFromZero);

        // Accumulate volume as a running sum so it never decreases
        var increment = Math.Round(flow / 72000m * IntervalSeconds, 3, MidpointRounding.AwayFromZero);

        if (!accumulatedVolume.TryGetValue(sensor.SensorId, out var previous))
            previous = baseVolume;

        var totalVolume = Math.Round(previous + increment, 3, MidpointRounding.AwayFromZero);
        accumulatedVolume[sensor.SensorId] = totalVolume;

        var negativeVolume = Math.Round(((seed / 7) % 350) / 1000m, 3, MidpointRounding.AwayFromZero);
        var positiveVolume = totalVolume + negativeVolume;
        var onDate = new decimal(timestamp.ToUnixTimeSeconds());

        return
        [
            new(sensor.SensorId, "Flow", "AXI", flow, timestamp, null, null),
            new(sensor.SensorId, "NegativeVolume", "AXI", negativeVolume, timestamp, null, null),
            new(sensor.SensorId, "OnDate", "AXI", onDate, timestamp, null, null),
            new(sensor.SensorId, "PositiveVolume", "AXI", positiveVolume, timestamp, null, null),
            new(sensor.SensorId, "TotalVolume", "AXI", totalVolume, timestamp, null, null),
        ];
    }
}
