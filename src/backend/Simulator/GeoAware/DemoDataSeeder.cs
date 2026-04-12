using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;

namespace Simulator.GeoAware;

public sealed class DemoDataSeeder(
    IServiceScopeFactory scopeFactory,
    ILogger<DemoDataSeeder> logger) : IHostedService
{
    private const string SensorIdPrefix = "SIM";
    private const string GatewayIdPrefix = "SIMGW";
    private const int MaxSensors = 200;

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var csvPath = FindCsvPath();
        if (csvPath is null)
        {
            logger.LogWarning("Simulator CSV not found — skipping demo data seeding.");
            return;
        }

        var addresses = AddressCsvReader.Read(csvPath);
        logger.LogInformation("Read {Count} addresses from CSV.", addresses.Count);

        var gatewayAddresses = GatewayPlacementStrategy.PickGatewayLocations(addresses);
        logger.LogInformation("Selected {Count} gateway locations.", gatewayAddresses.Count);

        var sensorAddresses = addresses
            .Except(gatewayAddresses)
            .Take(MaxSensors)
            .ToList();

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DatabaseContext>();

        var existingIds = await db.Devices
            .Where(d => d.UniqueId.StartsWith(SensorIdPrefix) || d.UniqueId.StartsWith(GatewayIdPrefix))
            .Select(d => d.UniqueId)
            .ToHashSetAsync(cancellationToken);

        var devicesToAdd = new List<Device>();

        for (var i = 0; i < gatewayAddresses.Count; i++)
        {
            var addr = gatewayAddresses[i];
            var uniqueId = $"{GatewayIdPrefix}{i + 1:D2}";
            if (existingIds.Contains(uniqueId))
                continue;

            devicesToAdd.Add(new Device
            {
                Id = Guid.NewGuid(),
                UniqueId = uniqueId,
                Name = $"Gateway {addr.PostalLocality} #{i + 1}",
                Description = addr.Address,
                Type = "Gateway",
                Manufacturer = "Simulator",
                Kind = DeviceKind.Gateway,
                Latitude = addr.Latitude,
                Longitude = addr.Longitude,
                InstallationDate = DateTimeOffset.UtcNow,
                LastContact = DateTimeOffset.UtcNow,
            });
        }

        for (var i = 0; i < sensorAddresses.Count; i++)
        {
            var addr = sensorAddresses[i];
            var uniqueId = $"{SensorIdPrefix}{i + 1:D4}";
            if (existingIds.Contains(uniqueId))
                continue;

            devicesToAdd.Add(new Device
            {
                Id = Guid.NewGuid(),
                UniqueId = uniqueId,
                Name = $"Vannmåler {addr.Address}",
                Description = addr.Address,
                Type = "ColdWater",
                Manufacturer = "AXI",
                Kind = DeviceKind.Sensor,
                Latitude = addr.Latitude,
                Longitude = addr.Longitude,
                InstallationDate = DateTimeOffset.UtcNow,
                LastContact = default,
            });
        }

        if (devicesToAdd.Count > 0)
        {
            db.Devices.AddRange(devicesToAdd);
            await db.SaveChangesAsync(cancellationToken);

            var gateways = devicesToAdd.Count(d => d.Kind == DeviceKind.Gateway);
            var sensors = devicesToAdd.Count(d => d.Kind == DeviceKind.Sensor);
            logger.LogInformation("Seeded {Count} demo devices ({Gateways} gateways, {Sensors} sensors).",
                devicesToAdd.Count, gateways, sensors);
        }
        else
        {
            logger.LogInformation("Demo data already seeded — no new devices added.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static string? FindCsvPath()
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "simulatordata", "gjerstad_adresser_med_lon_lat.csv"),
            Path.Combine(Directory.GetCurrentDirectory(), "simulatordata", "gjerstad_adresser_med_lon_lat.csv"),
            "/workspace/simulatordata/gjerstad_adresser_med_lon_lat.csv",
        };

        return candidates.FirstOrDefault(File.Exists);
    }
}
