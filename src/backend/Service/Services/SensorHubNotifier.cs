using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Options;
using service.Configuration;

namespace service.Services;

public interface ISensorHubNotifier
{
    Task NotifyReadingAsync(string sensorId, string sensorType, decimal value, DateTimeOffset timestamp, CancellationToken cancellationToken = default);
    Task NotifyGatewayPositionAsync(string gatewayId, DateTimeOffset timestamp, double? longitude, double? latitude, double? heading, bool driveBy, CancellationToken cancellationToken = default);
}

public class SensorHubNotifier : ISensorHubNotifier, IAsyncDisposable
{
    private readonly HubConnection _connection;
    private readonly ILogger<SensorHubNotifier> _logger;

    public SensorHubNotifier(IOptions<ApiOptions> options, ILogger<SensorHubNotifier> logger)
    {
        _logger = logger;
        _connection = new HubConnectionBuilder()
            .WithUrl($"{options.Value.BaseUrl}/hubs/sensors")
            .WithAutomaticReconnect()
            .Build();
    }

    private async Task EnsureConnectedAsync(CancellationToken cancellationToken)
    {
        if (_connection.State == HubConnectionState.Disconnected)
        {
            try
            {
                await _connection.StartAsync(cancellationToken);
                _logger.LogInformation("Connected to SignalR hub at {State}", _connection.State);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to connect to SignalR hub, will retry on next message");
            }
        }
    }

    public async Task NotifyReadingAsync(string sensorId, string sensorType, decimal value, DateTimeOffset timestamp, CancellationToken cancellationToken)
    {
        await EnsureConnectedAsync(cancellationToken);

        if (_connection.State != HubConnectionState.Connected)
            return;

        try
        {
            await _connection.InvokeAsync("SendReading", new
            {
                SensorId = sensorId,
                SensorType = sensorType,
                Value = value,
                Timestamp = timestamp.ToString("O"),
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send reading to SignalR hub");
        }
    }

    public async Task NotifyGatewayPositionAsync(string gatewayId, DateTimeOffset timestamp, double? longitude, double? latitude, double? heading, bool driveBy, CancellationToken cancellationToken)
    {
        await EnsureConnectedAsync(cancellationToken);

        if (_connection.State != HubConnectionState.Connected)
            return;

        try
        {
            await _connection.InvokeAsync("SendGatewayPosition", new
            {
                GatewayId = gatewayId,
                Timestamp = timestamp.ToString("O"),
                Longitude = longitude,
                Latitude = latitude,
                Heading = heading,
                DriveBy = driveBy,
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send gateway position to SignalR hub");
        }
    }

    public async ValueTask DisposeAsync()
    {
        await _connection.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}
