using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Services.Encryption;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.EncryptionKeys.Command;

public class UpdateEncryptionKeyCommandHandler(DatabaseContext db, IKeyEncryptionService encryptionService)
{
    public async Task<EncryptionKeyResponse?> HandleAsync(
        Guid id,
        UpdateEncryptionKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        var key = await db.EncryptionKeys.FirstOrDefaultAsync(k => k.Id == id, cancellationToken);
        if (key is null)
            return null;

        if (request.KeyValue is not null)
            key.EncryptedKeyValue = encryptionService.Encrypt(request.KeyValue);

        key.DeviceUniqueId = request.DeviceUniqueId ?? key.DeviceUniqueId;
        key.GroupName = request.GroupName ?? key.GroupName;
        key.Description = request.Description ?? key.Description;
        key.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return new EncryptionKeyResponse(
            key.Id, key.DeviceUniqueId, key.GroupName,
            key.Description, key.CreatedAt, key.UpdatedAt);
    }
}
