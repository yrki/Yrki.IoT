using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Users.Query;

public class UsersQueryHandler(DatabaseContext db, ILogger<UsersQueryHandler> logger)
{
    public async Task<IReadOnlyList<UserResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying all users");

        return await db.Users
            .AsNoTracking()
            .OrderBy(user => user.Email)
            .Select(user => new UserResponse(
                user.Id,
                user.Email,
                user.CreatedAtUtc,
                user.LastLoginAtUtc))
            .ToListAsync(cancellationToken);
    }
}
