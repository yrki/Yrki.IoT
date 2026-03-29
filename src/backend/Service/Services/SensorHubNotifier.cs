using System.Net.Http.Json;
using service.Configuration;
using Microsoft.Extensions.Options;

namespace service.Services;

public interface ISensorHubNotifier
{
    Task NotifyReadingAsync(string sensorId, string sensorType, decimal value, DateTimeOffset timestamp, CancellationToken cancellationToken = default);
}

public class SensorHubNotifier(
    HttpClient httpClient,
    IOptions<ApiOptions> options,
    ILogger<SensorHubNotifier> logger) : ISensorHubNotifier
{
    public async Task NotifyReadingAsync(string sensorId, string sensorType, decimal value, DateTimeOffset timestamp, CancellationToken cancellationToken)
    {
        try
        {
            await httpClient.PostAsJsonAsync(
                $"{options.Value.BaseUrl}/internal/sensor-readings",
                new { sensorId, sensorType, value, timestamp },
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Failed to push reading to API for SignalR broadcast");
        }
    }
}
