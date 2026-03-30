namespace Tests.Api.Fakes;

public sealed class FakeKeyEncryptionService : IKeyEncryptionService
{
    private const string Prefix = "encrypted:";

    public string Encrypt(string plainText)
    {
        return $"{Prefix}{plainText}";
    }

    public string Decrypt(string cipherText)
    {
        return cipherText.StartsWith(Prefix, StringComparison.Ordinal)
            ? cipherText[Prefix.Length..]
            : cipherText;
    }
}
