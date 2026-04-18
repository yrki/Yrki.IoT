using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.EncryptionKeys.Command;

public class DeleteEncryptionKeyCommandHandler(DatabaseContext db, ILogger<DeleteEncryptionKeyCommandHandler> logger)
{
    public async Task<bool> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var key = await db.EncryptionKeys.FirstOrDefaultAsync(k => k.Id == id, cancellationToken);
        if (key is null)
        {
            logger.LogWarning("Encryption key {KeyId} not found", id);
            return false;
        }

        db.EncryptionKeys.Remove(key);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Deleted encryption key {KeyId}", id);
        return true;
    }
}
