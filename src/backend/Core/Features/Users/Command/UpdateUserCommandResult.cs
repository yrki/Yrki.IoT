using Contracts.Responses;

namespace Core.Features.Users.Command;

public record UpdateUserCommandResult(UserResponse? User, bool DuplicateEmail)
{
    public static UpdateUserCommandResult NotFound() => new(null, false);

    public static UpdateUserCommandResult Conflict() => new(null, true);

    public static UpdateUserCommandResult Success(UserResponse user) => new(user, false);
}
