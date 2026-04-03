namespace Api.Configuration;

public class JwtOptions
{
    public string Issuer { get; set; } = "YrkiIoT";
    public string Audience { get; set; } = "YrkiIoT.Frontend";
    public string SigningKey { get; set; } = "change-this-development-signing-key-please-1234567890";
    public int LifetimeMinutes { get; set; } = 60 * 24 * 30;
}
