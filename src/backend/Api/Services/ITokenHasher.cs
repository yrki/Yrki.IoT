namespace Api.Services;

public interface ITokenHasher
{
    string Hash(string value);
}
