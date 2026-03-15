using Api.Contracts.Auth;

namespace Api.Services;

public interface IMagicLinkService
{
    Task RequestAsync(string email, CancellationToken cancellationToken);
    Task<AuthResponse?> VerifyAsync(string token, CancellationToken cancellationToken);
}
