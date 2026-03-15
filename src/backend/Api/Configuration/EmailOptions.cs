namespace Api.Configuration;

public class EmailOptions
{
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string FromEmail { get; set; } = "no-reply@yrkiiot.local";
    public string FromName { get; set; } = "Yrki IoT";
    public bool UseSsl { get; set; } = true;
}
