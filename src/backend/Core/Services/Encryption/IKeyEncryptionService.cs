namespace Core.Services.Encryption;

public interface IKeyEncryptionService
{
    string Encrypt(string plainText);
    string Decrypt(string cipherText);
}
