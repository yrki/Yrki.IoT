using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Locations.Command;

public class DeleteLocationCommandHandler(DatabaseContext db, ILogger<DeleteLocationCommandHandler> logger)
{
    public async Task<bool> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (location is null)
        {
            logger.LogWarning("Location {LocationId} not found", id);
            return false;
        }

        db.Locations.Remove(location);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Deleted location {LocationId}", id);
        return true;
    }
}
