using Contracts.Readings;
using EasyNetQ;

namespace service.Consumers;

public class RabbitMqSubscriptionWorker(
    IBus bus,
    IServiceScopeFactory scopeFactory,
    ILogger<RabbitMqSubscriptionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Starting RabbitMQ subscriptions...");

        await bus.PubSub.SubscribeAsync<SensorPayload>(
            "service",
            async (msg, ct) =>
            {
                using var scope = scopeFactory.CreateScope();
                var consumer = scope.ServiceProvider.GetRequiredService<SensorReadingConsumer>();
                await consumer.HandleAsync(msg, ct);
            },
            config => config.WithPrefetchCount(5),
            stoppingToken);

        await bus.PubSub.SubscribeAsync<SensorReadingReceived>(
            "service",
            async (msg, ct) =>
            {
                using var scope = scopeFactory.CreateScope();
                var consumer = scope.ServiceProvider.GetRequiredService<SensorReadingReceivedConsumer>();
                await consumer.HandleAsync(msg, ct);
            },
            config => config.WithPrefetchCount(5),
            stoppingToken);

        await bus.PubSub.SubscribeAsync<GatewayPositionReceived>(
            "service",
            async (msg, ct) =>
            {
                using var scope = scopeFactory.CreateScope();
                var consumer = scope.ServiceProvider.GetRequiredService<GatewayPositionConsumer>();
                await consumer.HandleAsync(msg, ct);
            },
            config => config.WithPrefetchCount(5),
            stoppingToken);

        logger.LogInformation("RabbitMQ subscriptions active");
    }
}
