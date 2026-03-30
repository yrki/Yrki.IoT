namespace Tests.Api.Fakes;

public sealed class FakeMagicLinkService : IMagicLinkService
{
    public string? RequestedEmail { get; private set; }
    public string? VerifiedToken { get; private set; }
    public AuthResponse? VerifyResponse { get; set; }

    public Task RequestAsync(string email, CancellationToken cancellationToken)
    {
        RequestedEmail = email;
        return Task.CompletedTask;
    }

    public Task<AuthResponse?> VerifyAsync(string token, CancellationToken cancellationToken)
    {
        VerifiedToken = token;
        return Task.FromResult(VerifyResponse);
    }
}
