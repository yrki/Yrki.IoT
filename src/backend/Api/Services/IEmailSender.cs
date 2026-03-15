namespace Api.Services;

public interface IEmailSender
{
    Task SendMagicLinkAsync(string email, string url, CancellationToken cancellationToken);
}
