using EasyNetQ;
using EasyNetQ.Serialization.SystemTextJson;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Simulator;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((context, services) =>
    {
        var config = context.Configuration;

        var rabbitHost = config["RabbitMq:Host"] ?? "localhost";
        var rabbitUser = config["RabbitMq:Username"] ?? "guest";
        var rabbitPassword = config["RabbitMq:Password"] ?? "guest";
        services.RegisterEasyNetQ($"host={rabbitHost};username={rabbitUser};password={rabbitPassword}")
            .UseSystemTextJson();

        services.AddDbContext<DatabaseContext>(options =>
            options.UseNpgsql(config.GetConnectionString("DatabaseConnectionString")));

        services.AddHostedService<MultiDeviceSimulatorWorker>();
        services.AddHostedService<WaterMeterSimulatorWorker>();
    })
    .Build();

host.Run();
