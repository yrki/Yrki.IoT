using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using service.Consumers;
using service.Services;

namespace tests;

[TestClass]
public class SensorReadingReceivedConsumerTests
{
    [TestMethod]
    public async Task Shall_update_device_last_contact_when_receiving_new_reading()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<DatabaseContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var db = new DatabaseContext(options);
        var device = new Device
        {
            Id = Guid.NewGuid(),
            UniqueId = "9900000",
            Name = "9900000",
            Description = "Test water meter",
            Type = "ColdWater",
            Manufacturer = "AXI",
            Kind = DeviceKind.Sensor,
            LastContact = new DateTimeOffset(2026, 4, 1, 0, 0, 0, TimeSpan.Zero),
            InstallationDate = new DateTimeOffset(2026, 4, 1, 0, 0, 0, TimeSpan.Zero),
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync();

        var consumer = new SensorReadingReceivedConsumer(
            db,
            new FakeSensorHubNotifier(),
            NullLogger<SensorReadingReceivedConsumer>.Instance);

        var message = new SensorReadingReceived(
            "9900000",
            "TotalVolume",
            "AXI",
            912.345m,
            new DateTimeOffset(2026, 4, 9, 12, 0, 0, TimeSpan.Zero),
            "ASKER-GW-0001",
            null);

        // Act
        await consumer.HandleAsync(message, CancellationToken.None);

        // Assert
        var storedDevice = await db.Devices.SingleAsync(stored => stored.UniqueId == "9900000");
        var storedReading = await db.SensorReadings.SingleAsync();

        Assert.AreEqual(message.Timestamp, storedDevice.LastContact);
        Assert.AreEqual(message.SensorType, storedReading.SensorType);
        Assert.AreEqual(message.Value, storedReading.Value);
    }

    private sealed class FakeSensorHubNotifier : ISensorHubNotifier
    {
        public Task NotifyReadingAsync(
            string sensorId,
            string sensorType,
            decimal value,
            DateTimeOffset timestamp,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task NotifyGatewayPositionAsync(
            string gatewayId,
            DateTimeOffset timestamp,
            double? longitude,
            double? latitude,
            double? heading,
            bool driveBy,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }
}
