using Core.Contexts;
using service.Configuration;
using service.Consumers;
using service.Services;
using Core.Services.Encryption;
using service.Mqtt;
using service.Workers;
using Serilog;
using Serilog.Events;
using Microsoft.EntityFrameworkCore;
using EasyNetQ;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .MinimumLevel.Override("EasyNetQ", LogEventLevel.Information)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", LogEventLevel.Warning)
    .WriteTo.Console()
    .CreateLogger();

try
{
    Log.Information("Starting Service...");

    var host = Host.CreateDefaultBuilder(args)
        .UseSerilog()
        .ConfigureServices((context, services) =>
        {
            var config = context.Configuration;

            services.Configure<MqttOptions>(config.GetSection("Mqtt"));

            var encryptionMasterKey = config["Encryption:MasterKey"]
                ?? throw new InvalidOperationException("Encryption:MasterKey must be configured.");
            services.AddSingleton<IKeyEncryptionService>(new AesKeyEncryptionService(encryptionMasterKey));

            services.AddDbContext<DatabaseContext>(options =>
                options.UseNpgsql(
                    config.GetConnectionString("DatabaseConnectionString"),
                    npgsql => npgsql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorCodesToAdd: null)));

            services.Configure<ApiOptions>(config.GetSection("Api"));
            services.AddSingleton<ISensorHubNotifier, SensorHubNotifier>();

            var rabbitHost = config["RabbitMq:Host"] ?? "localhost";
            var rabbitUser = config["RabbitMq:Username"] ?? "guest";
            var rabbitPassword = config["RabbitMq:Password"] ?? "guest";
            services.AddEasyNetQ($"host={rabbitHost};username={rabbitUser};password={rabbitPassword}")
                .UseSystemTextJson();

            services.AddScoped<SensorReadingConsumer>();
            services.AddScoped<SensorReadingReceivedConsumer>();
            services.AddScoped<GatewayPositionConsumer>();
            services.AddHostedService<RabbitMqSubscriptionWorker>();
            services.AddHostedService<MqttWMBusWorker>();
            services.AddHostedService<MqttGatewayWorker>();
            services.AddHostedService<DeviceDiscoveryWorker>();
        })
        .Build();

    using (var scope = host.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
        Log.Information("Applying database migrations...");
        await db.Database.MigrateAsync();
        Log.Information("Database migrations applied");
    }

    await host.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Service terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
