using MassTransit;
using Simulator;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((context, services) =>
    {
        var config = context.Configuration;

        services.AddMassTransit(x => x.UsingRabbitMq((_, cfg) => cfg.Host(config["RabbitMq:Host"] ?? "localhost", "/", h =>
                {
                    h.Username(config["RabbitMq:Username"] ?? "guest");
                    h.Password(config["RabbitMq:Password"] ?? "guest");
                })));

        services.AddHostedService<MultiDeviceSimulatorWorker>();
    })
    .Build();

host.Run();
