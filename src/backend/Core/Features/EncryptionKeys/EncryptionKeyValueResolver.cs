using Core.Services.Encryption;
using System.Security.Cryptography;

namespace Core.Features.EncryptionKeys;

public static class EncryptionKeyValueResolver
{
    public static string? ResolveForDisplay(string? storedValue, IKeyEncryptionService encryptionService)
    {
        if (string.IsNullOrWhiteSpace(storedValue))
            return null;

        var trimmedValue = storedValue.Trim();
        if (LooksLikeHexKey(trimmedValue))
            return trimmedValue.ToUpperInvariant();

        try
        {
            return encryptionService.Decrypt(trimmedValue);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException)
        {
            return null;
        }
    }

    private static bool LooksLikeHexKey(string value)
    {
        if (value.Length != 32)
            return false;

        foreach (var c in value)
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
