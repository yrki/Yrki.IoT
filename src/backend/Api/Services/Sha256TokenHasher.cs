using System.Security.Cryptography;
using System.Text;

namespace Api.Services;

public class Sha256TokenHasher : ITokenHasher
{
    public string Hash(string value)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(hash);
    }
}
