namespace Core.Services.Email;

public class EmailOptions
{
    public string? ConnectionString { get; set; }
    public string SenderAddress { get; set; } = "DoNotReply@yrkiiot.local";
}
