using EasyNetQ;
using Simulator;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((context, services) =>
    {
        var config = context.Configuration;

        var rabbitHost = config["RabbitMq:Host"] ?? "localhost";
        var rabbitUser = config["RabbitMq:Username"] ?? "guest";
        var rabbitPassword = config["RabbitMq:Password"] ?? "guest";
        services.RegisterEasyNetQ($"host={rabbitHost};username={rabbitUser};password={rabbitPassword}");

        services.AddHostedService<MultiDeviceSimulatorWorker>();
    })
    .Build();

host.Run();
