using Api.Mappers;
using Core.Models;

namespace tests;

[TestClass]
public class DeviceMappersTests
{
    [TestMethod]
    public void Shall_map_device_entity_to_contract()
    {
        // Arrange
        var locationId = Guid.NewGuid();
        var lastContact = DateTimeOffset.Parse("2026-03-16T09:30:00+00:00");
        var installationDate = DateTimeOffset.Parse("2026-01-10T12:00:00+00:00");
        var device = new Device
        {
            Id = Guid.NewGuid(),
            Name = "Office sensor",
            UniqueId = "CO2-1",
            Type = DeviceType.CO2,
            LocationId = locationId,
            Description = "Measures office air quality.",
            LastContact = lastContact,
            InstallationDate = installationDate,
        };

        // Act
        var result = device.MapToModel();

        // Assert
        Assert.AreEqual(device.Id, result.Id);
        Assert.AreEqual(device.Name, result.Name);
        Assert.AreEqual(device.UniqueId, result.UniqueId);
        Assert.AreEqual(global::Contracts.DeviceType.CO2, result.Type);
        Assert.AreEqual(locationId, result.LocationId);
        Assert.AreEqual(device.Description, result.Description);
        Assert.AreEqual(lastContact, result.LastContact);
        Assert.AreEqual(installationDate, result.InstallationDate);
    }
}
