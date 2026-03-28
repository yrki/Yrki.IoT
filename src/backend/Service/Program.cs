using Core.Contexts;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;
using Serilog.Events;
using service.Configuration;
using service.Consumers;
using service.Hardware;

var host = Host.CreateDefaultBuilder(args)
    .UseSerilog((context, _, config) =>
        config.MinimumLevel.Debug()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
            .WriteTo.Console()
            .Enrich.FromLogContext())
    .ConfigureLogging((ctx, builder) =>
    {
        builder.ClearProviders();
        builder.AddSerilog();
    })
    .ConfigureServices((context, services) =>
    {
        var config = context.Configuration;

        services.AddSerilog();

        services.Configure<WMBusOptions>(config.GetSection("WMBus"));

        services.AddDbContext<DatabaseContext>(options =>
            options.UseNpgsql(config.GetConnectionString("DatabaseConnectionString")));

        services.AddMassTransit(x =>
        {
            x.AddConsumer<SensorReadingConsumer>();
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
    })
    .Build();

host.Run();
