using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.RawPayloads.Query;

public class RawPayloadsQueryHandler(DatabaseContext db, ILogger<RawPayloadsQueryHandler> logger)
{
    public async Task<IReadOnlyList<RawPayloadResponse>> HandleAsync(
        string deviceId,
        int limit,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Querying raw payloads for device {DeviceId} with limit {Limit}", deviceId, limit);
        if (string.IsNullOrWhiteSpace(deviceId))
            return [];

        return await db.RawPayloads
            .AsNoTracking()
            .Where(r => r.DeviceId == deviceId)
            .OrderByDescending(r => r.ReceivedAt)
            .Take(limit)
            .Select(r => new RawPayloadResponse(
                r.Id,
                r.ReceivedAt,
                r.PayloadHex,
                r.Source,
                r.DeviceId,
                r.Manufacturer,
                r.GatewayId,
                r.Rssi,
                r.Error))
            .ToListAsync(cancellationToken);
    }
}
