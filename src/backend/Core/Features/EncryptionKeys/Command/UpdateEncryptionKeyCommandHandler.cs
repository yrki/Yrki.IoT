using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.EncryptionKeys.Command;

public class UpdateEncryptionKeyCommandHandler(DatabaseContext db, ILogger<UpdateEncryptionKeyCommandHandler> logger)
{
    public async Task<EncryptionKeyResponse?> HandleAsync(
        Guid id,
        UpdateEncryptionKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        var key = await db.EncryptionKeys.FirstOrDefaultAsync(k => k.Id == id, cancellationToken);
        if (key is null)
        {
            logger.LogWarning("Encryption key {KeyId} not found", id);
            return null;
        }

        if (request.KeyValue is not null)
            key.EncryptedKeyValue = request.KeyValue.Trim().ToUpperInvariant();

        key.Manufacturer = request.Manufacturer is null
            ? key.Manufacturer
            : EncryptionKeyIdentity.NormalizeManufacturer(request.Manufacturer);
        key.DeviceUniqueId = request.DeviceUniqueId is null
            ? key.DeviceUniqueId
            : EncryptionKeyIdentity.NormalizeDeviceUniqueId(request.DeviceUniqueId);
        key.GroupName = request.GroupName ?? key.GroupName;
        key.Description = request.Description ?? key.Description;
        key.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Updated encryption key {KeyId}", id);
        return new EncryptionKeyResponse(
            key.Id, key.Manufacturer, key.DeviceUniqueId, key.GroupName,
            key.Description, key.EncryptedKeyValue, key.CreatedAt, key.UpdatedAt);
    }
}
