using System.Buffers;
using System.Text.Json;
using Contracts.Mqtt;
using Contracts.Readings;
using EasyNetQ;
using Microsoft.Extensions.Options;
using MQTTnet;
using service.Configuration;

namespace service.Mqtt;

public class MqttGatewayWorker(
    IOptions<MqttOptions> options,
    IBus bus,
    ILogger<MqttGatewayWorker> logger) : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var opts = options.Value;

        if (!opts.Enabled)
        {
            logger.LogInformation("MqttGatewayWorker disabled via config");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConnectAndSubscribeAsync(opts, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "MQTT gateway connection lost, retrying in 5s");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task ConnectAndSubscribeAsync(MqttOptions opts, CancellationToken stoppingToken)
    {
        var factory = new MqttClientFactory();
        using var client = factory.CreateMqttClient();

        var optionsBuilder = factory.CreateClientOptionsBuilder()
            .WithTcpServer(opts.Host, opts.Port)
            .WithClientId($"{opts.ClientId}-gateway");

        if (!string.IsNullOrEmpty(opts.Username))
            optionsBuilder.WithCredentials(opts.Username, opts.Password);

        client.ApplicationMessageReceivedAsync += async e =>
        {
            await HandleMessageAsync(e, stoppingToken);
        };

        logger.LogInformation("Connecting to MQTT broker at {Host}:{Port} for gateway positions...", opts.Host, opts.Port);
        await client.ConnectAsync(optionsBuilder.Build(), stoppingToken);
        logger.LogInformation("Connected to MQTT broker, subscribing to {Topic}", opts.GatewayTopic);

        var subscribeOptions = factory.CreateSubscribeOptionsBuilder()
            .WithTopicFilter(f => f.WithTopic(opts.GatewayTopic))
            .Build();

        await client.SubscribeAsync(subscribeOptions, stoppingToken);
        logger.LogInformation("Subscribed to MQTT topic {Topic}", opts.GatewayTopic);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // Shutting down
        }

        await client.DisconnectAsync(new MqttClientDisconnectOptionsBuilder().Build(), CancellationToken.None);
    }

    private async Task HandleMessageAsync(MqttApplicationMessageReceivedEventArgs e, CancellationToken stoppingToken)
    {
        try
        {
            var payloadBytes = e.ApplicationMessage.Payload.ToArray();
            var message = JsonSerializer.Deserialize<GatewayMqttMessage>(payloadBytes, JsonOptions);

            if (message is null || string.IsNullOrWhiteSpace(message.GatewayId))
            {
                logger.LogWarning("Received gateway MQTT message with empty or invalid payload");
                return;
            }

            logger.LogInformation(
                "Received gateway position via MQTT gateway={Gateway}, lat={Lat}, lon={Lon}, driveBy={DriveBy}",
                message.GatewayId,
                message.Lat,
                message.Lon,
                message.DriveBy);

            await bus.PubSub.PublishAsync(
                new GatewayPositionReceived(
                    message.GatewayId,
                    message.Timestamp,
                    message.Lon,
                    message.Lat,
                    message.Heading,
                    message.DriveBy),
                stoppingToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to process gateway MQTT message on topic {Topic}", e.ApplicationMessage.Topic);
        }
    }
}
