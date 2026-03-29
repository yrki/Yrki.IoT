using Core.Contexts;
using service.Configuration;
using service.Consumers;
using service.Services;
using Core.Services.Encryption;
using service.Hardware;
using service.Workers;
using Serilog;
using Serilog.Events;
using Microsoft.EntityFrameworkCore;
using MassTransit;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .MinimumLevel.Override("MassTransit", LogEventLevel.Information)
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

            services.Configure<WMBusOptions>(config.GetSection("WMBus"));

            var encryptionMasterKey = config["Encryption:MasterKey"]
                ?? throw new InvalidOperationException("Encryption:MasterKey must be configured.");
            services.AddSingleton<IKeyEncryptionService>(new AesKeyEncryptionService(encryptionMasterKey));

            services.AddDbContext<DatabaseContext>(options =>
                options.UseNpgsql(config.GetConnectionString("DatabaseConnectionString")));

            services.Configure<ApiOptions>(config.GetSection("Api"));
            services.AddHttpClient<ISensorHubNotifier, SensorHubNotifier>();

            services.AddMassTransit(x =>
            {
                x.AddConsumer<SensorReadingConsumer>();
                x.AddConsumer<SensorReadingReceivedConsumer>();
                x.UsingRabbitMq((ctx, cfg) =>
                {
                    cfg.Host(config["RabbitMq:Host"], "/", h =>
                    {
                        h.Username(config["RabbitMq:Username"] ?? "guest");
                        h.Password(config["RabbitMq:Password"] ?? "guest");
                    });
                    cfg.ConfigureEndpoints(ctx);
                });
            });

            services.AddHostedService<WMBusSerialWorker>();
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
