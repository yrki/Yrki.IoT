using System.Buffers;
using System.Text.Json;
using Contracts.Mqtt;
using Contracts.Readings;
using EasyNetQ;
using Microsoft.Extensions.Options;
using MQTTnet;
using service.Configuration;

namespace service.Mqtt;

public class MqttWMBusWorker(
    IOptions<MqttOptions> options,
    IBus bus,
    ILogger<MqttWMBusWorker> logger) : BackgroundService
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
            logger.LogInformation("MqttWMBusWorker disabled via config");
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
                logger.LogError(ex, "MQTT connection lost, retrying in 5s");
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
            .WithClientId(opts.ClientId);

        if (!string.IsNullOrEmpty(opts.Username))
            optionsBuilder.WithCredentials(opts.Username, opts.Password);

        client.ApplicationMessageReceivedAsync += async e =>
        {
            await HandleMessageAsync(e, stoppingToken);
        };

        logger.LogInformation("Connecting to MQTT broker at {Host}:{Port}...", opts.Host, opts.Port);
        await client.ConnectAsync(optionsBuilder.Build(), stoppingToken);
        logger.LogInformation("Connected to MQTT broker, subscribing to {Topic}", opts.Topic);

        var subscribeOptions = factory.CreateSubscribeOptionsBuilder()
            .WithTopicFilter(f => f.WithTopic(opts.Topic))
            .Build();

        await client.SubscribeAsync(subscribeOptions, stoppingToken);
        logger.LogInformation("Subscribed to MQTT topic {Topic}", opts.Topic);

        // Keep alive until cancelled
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
            var message = JsonSerializer.Deserialize<WMBusMqttMessage>(payloadBytes, JsonOptions);

            if (message is null || string.IsNullOrWhiteSpace(message.PayloadHex))
            {
                logger.LogWarning("Received MQTT message with empty or invalid payload");
                return;
            }

            var timestamp = message.Timestamp ?? DateTimeOffset.UtcNow;

            logger.LogInformation(
                "Received WMBus via MQTT from gateway={Gateway}, rssi={Rssi}, payload={Length} chars",
                message.GatewayId ?? "unknown",
                message.Rssi,
                message.PayloadHex.Length);

            await bus.PubSub.PublishAsync(
                new SensorPayload(message.PayloadHex, timestamp, "mqtt", message.GatewayId, message.Rssi),
                stoppingToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to process MQTT message on topic {Topic}", e.ApplicationMessage.Topic);
        }
    }
}
