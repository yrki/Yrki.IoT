namespace Tests.Api.TestData;

public static class ApiTestData
{
    public static Location CreateLocation(
        string name = "Main office",
        string description = "Primary site")
    {
        return new Location
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = description
        };
    }

    public static Device CreateDevice(
        string uniqueId,
        string name,
        string type,
        string description,
        string manufacturer = "Acme",
        Guid? locationId = null,
        Location? location = null,
        bool isNew = false,
        bool isDeleted = false,
        DateTimeOffset? lastContact = null,
        DateTimeOffset? installationDate = null)
    {
        return new Device
        {
            Id = Guid.NewGuid(),
            UniqueId = uniqueId,
            Name = name,
            Type = type,
            Description = description,
            Manufacturer = manufacturer,
            LocationId = locationId,
            Location = location,
            IsNew = isNew,
            IsDeleted = isDeleted,
            LastContact = lastContact ?? DateTimeOffset.UtcNow.AddMinutes(-5),
            InstallationDate = installationDate ?? DateTimeOffset.UtcNow.AddDays(-30)
        };
    }

    public static EncryptionKey CreateEncryptionKey(
        string? manufacturer = "ACME",
        string? deviceUniqueId = "device-1",
        string? groupName = "default",
        string encryptedKeyValue = "encrypted:key",
        string? description = "Test key")
    {
        return new EncryptionKey
        {
            Id = Guid.NewGuid(),
            Manufacturer = manufacturer,
            DeviceUniqueId = deviceUniqueId,
            GroupName = groupName,
            EncryptedKeyValue = encryptedKeyValue,
            Description = description,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
    }

    public static SensorReading CreateSensorReading(
        string sensorId,
        string sensorType,
        decimal value,
        DateTimeOffset timestamp)
    {
        return new SensorReading
        {
            SensorId = sensorId,
            SensorType = sensorType,
            Value = value,
            Timestamp = timestamp
        };
    }

    public static AppUser CreateUser(string email = "user@example.com")
    {
        return new AppUser
        {
            Id = Guid.NewGuid(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            CreatedAtUtc = DateTime.UtcNow.AddDays(-7)
        };
    }
}
