using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.RawPayloads.Query;

public class RawPayloadsQueryHandler(DatabaseContext db)
{
    public async Task<IReadOnlyList<RawPayloadResponse>> HandleAsync(
        string deviceId,
        int limit,
        CancellationToken cancellationToken = default)
    {
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
