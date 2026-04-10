namespace Core.Features.Users;

public static class UserEmailNormalizer
{
    public static string Normalize(string email) => email.Trim().ToUpperInvariant();
}
