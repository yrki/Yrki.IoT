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
        DeviceKind kind = DeviceKind.Sensor,
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
            Kind = kind,
            LocationId = locationId,
            Location = location,
            IsNew = isNew,
            IsDeleted = isDeleted,
            LastContact = lastContact ?? DateTimeOffset.UtcNow.AddMinutes(-5),
            InstallationDate = installationDate ?? DateTimeOffset.UtcNow.AddDays(-30)
        };
    }

    public static GatewayReading CreateGatewayReading(
        string gatewayUniqueId,
        string sensorUniqueId,
        DateTimeOffset receivedAt,
        int? rssi = null)
    {
        return new GatewayReading
        {
            Id = Guid.NewGuid(),
            GatewayUniqueId = gatewayUniqueId,
            SensorUniqueId = sensorUniqueId,
            ReceivedAt = receivedAt,
            Rssi = rssi,
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
            Manufacturer = EncryptionKeyIdentity.NormalizeManufacturer(manufacturer),
            DeviceUniqueId = EncryptionKeyIdentity.NormalizeDeviceUniqueId(deviceUniqueId),
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
        DateTimeOffset timestamp,
        string? gatewayId = null,
        int? rssi = null)
    {
        return new SensorReading
        {
            SensorId = sensorId,
            SensorType = sensorType,
            Value = value,
            Timestamp = timestamp,
            GatewayId = gatewayId,
            Rssi = rssi,
        };
    }

    public static GatewayPosition CreateGatewayPosition(
        string gatewayUniqueId,
        DateTimeOffset timestamp,
        double? longitude = null,
        double? latitude = null,
        double? heading = null,
        bool driveBy = false)
    {
        return new GatewayPosition
        {
            GatewayUniqueId = gatewayUniqueId,
            Timestamp = timestamp,
            Longitude = longitude,
            Latitude = latitude,
            Heading = heading,
            DriveBy = driveBy,
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
