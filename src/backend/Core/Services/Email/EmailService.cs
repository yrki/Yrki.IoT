using Azure;
using Azure.Communication.Email;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Core.Services.Email;

public class EmailService : IEmailService
{
    private readonly EmailOptions _options;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<EmailOptions> options, ILogger<EmailService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(
        string recipientEmail,
        string subject,
        string plainTextContent,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ConnectionString))
        {
            _logger.LogInformation(
                "Email sending is disabled. Intended message to {RecipientEmail}. Subject: {Subject}. Body: {Body}",
                recipientEmail,
                subject,
                plainTextContent);
            return;
        }

        var client = new EmailClient(_options.ConnectionString);

        var message = new EmailMessage(
            senderAddress: _options.SenderAddress,
            recipients: new EmailRecipients(
                new[]
                {
                    new EmailAddress(recipientEmail)
                }),
            content: new EmailContent(subject)
            {
                PlainText = plainTextContent
            });

        var operation = await client.SendAsync(WaitUntil.Completed, message, cancellationToken);

        if (operation.Value.Status != EmailSendStatus.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to send email to {recipientEmail}. Email send status was '{operation.Value.Status}'.");
        }
    }
}
