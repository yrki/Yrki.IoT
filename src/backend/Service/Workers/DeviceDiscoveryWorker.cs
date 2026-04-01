using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;

namespace service.Workers;

public class DeviceDiscoveryWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<DeviceDiscoveryWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Device discovery worker started — checking every {Interval}", Interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DiscoverNewDevicesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Device discovery failed");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task DiscoverNewDevicesAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DatabaseContext>();

        var knownSensorIds = await db.Devices
            .AsNoTracking()
            .Select(d => d.UniqueId)
            .ToListAsync(cancellationToken);

        var newSensorIds = await db.SensorReadings
            .AsNoTracking()
            .Select(r => r.SensorId)
            .Distinct()
            .Where(id => !knownSensorIds.Contains(id))
            .ToListAsync(cancellationToken);

        if (newSensorIds.Count == 0)
        {
            logger.LogDebug("No new sensors discovered");
            return;
        }

        foreach (var sensorId in newSensorIds)
        {
            var latestReading = await db.SensorReadings
                .AsNoTracking()
                .Where(r => r.SensorId == sensorId)
                .OrderByDescending(r => r.Timestamp)
                .FirstAsync(cancellationToken);

            var device = new Device
            {
                Id = Guid.NewGuid(),
                UniqueId = sensorId,
                Name = sensorId,
                Description = string.Empty,
                Type = "Unknown",
                Manufacturer = latestReading.Manufacturer,
                IsNew = true,
                LocationId = null,
                LastContact = latestReading.Timestamp,
                InstallationDate = latestReading.Timestamp,
            };

            db.Devices.Add(device);
            logger.LogInformation("Discovered new sensor {SensorId}", sensorId);
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Registered {Count} new sensor(s)", newSensorIds.Count);
    }
}
