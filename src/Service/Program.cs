using service;
using Serilog;
using Serilog.Events;

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
    .ConfigureServices(services =>
    {
        services.AddSerilog();
        services.AddHostedService<Worker>();
    })
    .Build();

host.Run();