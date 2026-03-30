using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Core.Services.Encryption;

namespace Core.Features.EncryptionKeys.Command;

public class CreateEncryptionKeyCommandHandler(DatabaseContext db, IKeyEncryptionService encryptionService)
{
    public async Task<EncryptionKeyResponse> HandleAsync(
        CreateEncryptionKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        var key = new EncryptionKey
        {
            Id = Guid.NewGuid(),
            DeviceUniqueId = request.DeviceUniqueId,
            GroupName = request.GroupName,
            EncryptedKeyValue = encryptionService.Encrypt(request.KeyValue),
            Description = request.Description,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.EncryptionKeys.Add(key);
        await db.SaveChangesAsync(cancellationToken);

        return new EncryptionKeyResponse(
            key.Id, key.DeviceUniqueId, key.GroupName,
            key.Description, key.CreatedAt, key.UpdatedAt);
    }
}
