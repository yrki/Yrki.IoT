using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Users.Command;

public class CreateUserCommandHandler(DatabaseContext db)
{
    public async Task<UserResponse?> HandleAsync(
        CreateUserRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = UserEmailNormalizer.Normalize(request.Email);
        var existingUser = await db.Users
            .AsNoTracking()
            .AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken);

        if (existingUser)
        {
            return null;
        }

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = request.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            CreatedAtUtc = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        return new UserResponse(user.Id, user.Email, user.CreatedAtUtc, user.LastLoginAtUtc);
    }
}
