using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.EncryptionKeys.Query;

public class EncryptionKeysQueryHandler(DatabaseContext db)
{
    public async Task<IReadOnlyList<EncryptionKeyResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
        return await db.EncryptionKeys
            .AsNoTracking()
            .OrderBy(k => k.DeviceUniqueId)
            .ThenBy(k => k.GroupName)
            .Select(k => new EncryptionKeyResponse(
                k.Id,
                k.DeviceUniqueId,
                k.GroupName,
                k.Description,
                k.CreatedAt,
                k.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<EncryptionKeyResponse?> HandleByDeviceAsync(
        string deviceUniqueId,
        CancellationToken cancellationToken = default)
    {
        return await db.EncryptionKeys
            .AsNoTracking()
            .Where(k => k.DeviceUniqueId == deviceUniqueId)
            .Select(k => new EncryptionKeyResponse(
                k.Id,
                k.DeviceUniqueId,
                k.GroupName,
                k.Description,
                k.CreatedAt,
                k.UpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
