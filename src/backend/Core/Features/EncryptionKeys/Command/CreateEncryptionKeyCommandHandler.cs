using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.Extensions.Logging;

namespace Core.Features.EncryptionKeys.Command;

public class CreateEncryptionKeyCommandHandler(DatabaseContext db, ILogger<CreateEncryptionKeyCommandHandler> logger)
{
    public async Task<EncryptionKeyResponse> HandleAsync(
        CreateEncryptionKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        var key = new EncryptionKey
        {
            Id = Guid.NewGuid(),
            Manufacturer = EncryptionKeyIdentity.NormalizeManufacturer(request.Manufacturer),
            DeviceUniqueId = EncryptionKeyIdentity.NormalizeDeviceUniqueId(request.DeviceUniqueId),
            GroupName = request.GroupName,
            EncryptedKeyValue = request.KeyValue.Trim().ToUpperInvariant(),
            Description = request.Description,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.EncryptionKeys.Add(key);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Created encryption key {KeyId} for {Manufacturer}/{DeviceUniqueId}", key.Id, key.Manufacturer, key.DeviceUniqueId);
        return new EncryptionKeyResponse(
            key.Id, key.Manufacturer, key.DeviceUniqueId, key.GroupName,
            key.Description, key.EncryptedKeyValue, key.CreatedAt, key.UpdatedAt);
    }
}
