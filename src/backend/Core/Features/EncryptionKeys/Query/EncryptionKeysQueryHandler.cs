using Contracts.Responses;
using Core.Contexts;
using Core.Services.Encryption;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.EncryptionKeys.Query;

public class EncryptionKeysQueryHandler(DatabaseContext db, IKeyEncryptionService encryptionService)
{
    public async Task<IReadOnlyList<EncryptionKeyResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
        var keys = await db.EncryptionKeys
            .AsNoTracking()
            .OrderBy(k => k.DeviceUniqueId)
            .ThenBy(k => k.Manufacturer)
            .ThenBy(k => k.GroupName)
            .ToListAsync(cancellationToken);

        return keys
            .Select(k => new EncryptionKeyResponse(
                k.Id,
                k.Manufacturer,
                k.DeviceUniqueId,
                k.GroupName,
                k.Description,
                EncryptionKeyValueResolver.ResolveForDisplay(k.EncryptedKeyValue, encryptionService),
                k.CreatedAt,
                k.UpdatedAt))
            .ToList();
    }

    public async Task<EncryptionKeyResponse?> HandleByDeviceAsync(
        string deviceUniqueId,
        string? manufacturer = null,
        CancellationToken cancellationToken = default)
    {
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
            EncryptionKeyValueResolver.ResolveForDisplay(key.EncryptedKeyValue, encryptionService),
            key.CreatedAt,
            key.UpdatedAt);
    }
}
