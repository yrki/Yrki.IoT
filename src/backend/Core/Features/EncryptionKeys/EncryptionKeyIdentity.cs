namespace Core.Features.EncryptionKeys;

public static class EncryptionKeyIdentity
{
    public static string? NormalizeManufacturer(string? manufacturer) =>
        string.IsNullOrWhiteSpace(manufacturer)
            ? null
            : manufacturer.Trim().ToUpperInvariant();

    public static string? NormalizeDeviceUniqueId(string? deviceUniqueId) =>
        string.IsNullOrWhiteSpace(deviceUniqueId)
            ? null
            : deviceUniqueId.Trim().ToUpperInvariant();
}
