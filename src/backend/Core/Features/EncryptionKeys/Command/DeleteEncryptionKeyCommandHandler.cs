using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.EncryptionKeys.Command;

public class DeleteEncryptionKeyCommandHandler(DatabaseContext db)
{
    public async Task<bool> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var key = await db.EncryptionKeys.FirstOrDefaultAsync(k => k.Id == id, cancellationToken);
        if (key is null)
            return false;

        db.EncryptionKeys.Remove(key);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
