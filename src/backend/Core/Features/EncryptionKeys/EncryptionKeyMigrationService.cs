using Core.Contexts;
using Core.Services.Encryption;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.EncryptionKeys;

public static class EncryptionKeyMigrationService
{
    public static async Task MigratePlaintextKeysAsync(
        DatabaseContext db,
        IKeyEncryptionService encryptionService,
        ILogger logger)
    {
        var keys = await db.EncryptionKeys.ToListAsync();
        var migrated = 0;

        foreach (var key in keys)
        {
            if (!LooksLikeHexKey(key.EncryptedKeyValue))
                continue;

            key.EncryptedKeyValue = encryptionService.Encrypt(key.EncryptedKeyValue.Trim().ToUpperInvariant());
            migrated++;
        }

        if (migrated > 0)
        {
            await db.SaveChangesAsync();
            logger.LogInformation("Migrated {Count} plaintext encryption keys to encrypted storage", migrated);
        }
    }

    private static bool LooksLikeHexKey(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Length != 32)
            return false;

        foreach (var c in trimmed)
        {
            var isHexDigit =
                (c >= '0' && c <= '9') ||
                (c >= 'a' && c <= 'f') ||
                (c >= 'A' && c <= 'F');

            if (!isHexDigit)
                return false;
        }

        return true;
    }
}
