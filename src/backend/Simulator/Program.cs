using EasyNetQ;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Simulator.GeoAware;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((context, services) =>
    {
        var config = context.Configuration;

        var rabbitHost = config["RabbitMq:Host"] ?? "localhost";
        var rabbitUser = config["RabbitMq:Username"] ?? "guest";
        var rabbitPassword = config["RabbitMq:Password"] ?? "guest";
        services.AddEasyNetQ($"host={rabbitHost};username={rabbitUser};password={rabbitPassword}")
            .UseSystemTextJson();

        services.AddDbContext<DatabaseContext>(options =>
            options.UseNpgsql(config.GetConnectionString("DatabaseConnectionString")));

        services.AddSingleton<IHostedService, DemoDataSeeder>();
        services.AddHostedService<GeoAwareSimulatorWorker>();
    })
    .Build();

host.Run();
