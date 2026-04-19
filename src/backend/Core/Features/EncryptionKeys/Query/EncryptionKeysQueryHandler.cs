using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.EncryptionKeys.Query;

public class EncryptionKeysQueryHandler(DatabaseContext db, ILogger<EncryptionKeysQueryHandler> logger)
{
    public async Task<IReadOnlyList<EncryptionKeyResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying all encryption keys");

        return await db.EncryptionKeys
            .AsNoTracking()
            .OrderBy(k => k.DeviceUniqueId)
            .ThenBy(k => k.Manufacturer)
            .ThenBy(k => k.GroupName)
            .Select(k => new EncryptionKeyResponse(
                k.Id,
                k.Manufacturer,
                k.DeviceUniqueId,
                k.GroupName,
                k.Description,
                null,
                !string.IsNullOrWhiteSpace(k.EncryptedKeyValue),
                k.CreatedAt,
                k.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<EncryptionKeyResponse?> HandleByDeviceAsync(
        string deviceUniqueId,
        string? manufacturer = null,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying encryption key for device {DeviceUniqueId}", deviceUniqueId);

        var normalizedManufacturer = EncryptionKeyIdentity.NormalizeManufacturer(manufacturer);
        var normalizedDeviceUniqueId = EncryptionKeyIdentity.NormalizeDeviceUniqueId(deviceUniqueId);

        var key = await db.EncryptionKeys
            .AsNoTracking()
            .Where(k =>
                k.DeviceUniqueId == normalizedDeviceUniqueId &&
                (normalizedManufacturer == null || k.Manufacturer == normalizedManufacturer))
            .FirstOrDefaultAsync(cancellationToken);

        if (key is null)
            return null;

        return new EncryptionKeyResponse(
            key.Id,
            key.Manufacturer,
            key.DeviceUniqueId,
            key.GroupName,
            key.Description,
            null,
            !string.IsNullOrWhiteSpace(key.EncryptedKeyValue),
            key.CreatedAt,
            key.UpdatedAt);
    }
}
