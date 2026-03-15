namespace Core.Services.Email;

public interface IEmailService
{
    Task SendAsync(
        string recipientEmail,
        string subject,
        string plainTextContent,
        CancellationToken cancellationToken);
}
