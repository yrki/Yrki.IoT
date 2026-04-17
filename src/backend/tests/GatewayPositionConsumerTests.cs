using Contracts.Readings;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using service.Consumers;
using service.Services;

namespace tests;

[TestClass]
public class GatewayPositionConsumerTests
{
    [TestMethod]
    public async Task Shall_store_gateway_position()
    {
        // Arrange
        var (db, consumer) = CreateConsumer();

        var message = new GatewayPositionReceived(
            "GW-001",
            new DateTimeOffset(2026, 4, 17, 12, 0, 0, TimeSpan.Zero),
            Longitude: 10.7522,
            Latitude: 59.9139,
            Heading: 45.0,
            DriveBy: false);

        // Act
        await consumer.HandleAsync(message, CancellationToken.None);

        // Assert
        var stored = await db.GatewayPositions.SingleAsync();
        Assert.AreEqual("GW-001", stored.GatewayUniqueId);
        Assert.AreEqual(10.7522, stored.Longitude);
        Assert.AreEqual(59.9139, stored.Latitude);
        Assert.AreEqual(45.0, stored.Heading);
        Assert.IsFalse(stored.DriveBy);
        Assert.AreEqual(message.Timestamp, stored.Timestamp);
    }

    [TestMethod]
    public async Task Shall_store_drive_by_position()
    {
        // Arrange
        var (db, consumer) = CreateConsumer();

        var message = new GatewayPositionReceived(
            "GW-002",
            new DateTimeOffset(2026, 4, 17, 13, 0, 0, TimeSpan.Zero),
            Longitude: 10.75,
            Latitude: 59.91,
            DriveBy: true);

        // Act
        await consumer.HandleAsync(message, CancellationToken.None);

        // Assert
        var stored = await db.GatewayPositions.SingleAsync();
        Assert.IsTrue(stored.DriveBy);
    }

    [TestMethod]
    public async Task Shall_update_device_last_contact_and_coordinates()
    {
        // Arrange
        var (db, consumer) = CreateConsumer();

        var device = new Device
        {
            Id = Guid.NewGuid(),
            UniqueId = "GW-001",
            Name = "Gateway 1",
            Description = "Test gateway",
            Type = "LoRa",
            Kind = DeviceKind.Gateway,
            LastContact = new DateTimeOffset(2026, 4, 1, 0, 0, 0, TimeSpan.Zero),
            InstallationDate = new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero),
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync();

        var message = new GatewayPositionReceived(
            "GW-001",
            new DateTimeOffset(2026, 4, 17, 14, 0, 0, TimeSpan.Zero),
            Longitude: 10.4,
            Latitude: 63.4);

        // Act
        await consumer.HandleAsync(message, CancellationToken.None);

        // Assert
        var updatedDevice = await db.Devices.SingleAsync(d => d.UniqueId == "GW-001");
        Assert.AreEqual(message.Timestamp, updatedDevice.LastContact);
        Assert.AreEqual(63.4, updatedDevice.Latitude);
        Assert.AreEqual(10.4, updatedDevice.Longitude);
    }

    [TestMethod]
    public async Task Shall_not_update_device_last_contact_when_older_timestamp()
    {
        // Arrange
        var (db, consumer) = CreateConsumer();

        var newerTimestamp = new DateTimeOffset(2026, 4, 17, 15, 0, 0, TimeSpan.Zero);
        var device = new Device
        {
            Id = Guid.NewGuid(),
            UniqueId = "GW-001",
            Name = "Gateway 1",
            Description = "Test gateway",
            Type = "LoRa",
            Kind = DeviceKind.Gateway,
            LastContact = newerTimestamp,
            InstallationDate = new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero),
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync();

        var message = new GatewayPositionReceived(
            "GW-001",
            new DateTimeOffset(2026, 4, 17, 10, 0, 0, TimeSpan.Zero),
            Longitude: 10.0,
            Latitude: 60.0);

        // Act
        await consumer.HandleAsync(message, CancellationToken.None);

        // Assert
        var updatedDevice = await db.Devices.SingleAsync(d => d.UniqueId == "GW-001");
        Assert.AreEqual(newerTimestamp, updatedDevice.LastContact);
    }

    [TestMethod]
    public async Task Shall_store_position_without_coordinates()
    {
        // Arrange
        var (db, consumer) = CreateConsumer();

        var message = new GatewayPositionReceived(
            "GW-003",
            new DateTimeOffset(2026, 4, 17, 16, 0, 0, TimeSpan.Zero));

        // Act
        await consumer.HandleAsync(message, CancellationToken.None);

        // Assert
        var stored = await db.GatewayPositions.SingleAsync();
        Assert.AreEqual("GW-003", stored.GatewayUniqueId);
        Assert.IsNull(stored.Longitude);
        Assert.IsNull(stored.Latitude);
        Assert.IsNull(stored.Heading);
    }

    [TestMethod]
    public async Task Shall_not_update_sensor_device_coordinates()
    {
        // Arrange
        var (db, consumer) = CreateConsumer();

        var device = new Device
        {
            Id = Guid.NewGuid(),
            UniqueId = "GW-001",
            Name = "Sensor pretending to be gateway",
            Description = "Test",
            Type = "Meter",
            Kind = DeviceKind.Sensor,
            LastContact = new DateTimeOffset(2026, 4, 1, 0, 0, 0, TimeSpan.Zero),
            InstallationDate = new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero),
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync();

        var message = new GatewayPositionReceived(
            "GW-001",
            new DateTimeOffset(2026, 4, 17, 14, 0, 0, TimeSpan.Zero),
            Longitude: 10.4,
            Latitude: 63.4);

        // Act
        await consumer.HandleAsync(message, CancellationToken.None);

        // Assert
        var updatedDevice = await db.Devices.SingleAsync(d => d.UniqueId == "GW-001");
        Assert.AreEqual(new DateTimeOffset(2026, 4, 1, 0, 0, 0, TimeSpan.Zero), updatedDevice.LastContact);
        Assert.IsNull(updatedDevice.Latitude);
        Assert.IsNull(updatedDevice.Longitude);
    }

    private static (DatabaseContext db, GatewayPositionConsumer consumer) CreateConsumer()
    {
        var options = new DbContextOptionsBuilder<DatabaseContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var db = new DatabaseContext(options);
        var consumer = new GatewayPositionConsumer(
            db,
            new FakeSensorHubNotifier(),
            NullLogger<GatewayPositionConsumer>.Instance);

        return (db, consumer);
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
