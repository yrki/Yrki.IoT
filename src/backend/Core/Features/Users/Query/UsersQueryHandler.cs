using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Users.Query;

public class UsersQueryHandler(DatabaseContext db)
{
    public async Task<IReadOnlyList<UserResponse>> HandleAsync(CancellationToken cancellationToken = default)
    {
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
