namespace Api.Configuration;

public class MagicLinkOptions
{
    public string FrontendBaseUrl { get; set; } = "http://localhost:5173";
    public int TokenLifetimeMinutes { get; set; } = 15;
}
