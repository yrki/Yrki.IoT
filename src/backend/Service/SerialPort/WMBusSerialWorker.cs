using Contracts.Readings;
using MassTransit;
using Microsoft.Extensions.Options;
using service.Configuration;
using Yrki.IoT.WMBus.Parser.Extensions;
using SerialPort = System.IO.Ports.SerialPort;

namespace service.Hardware;

public class WMBusSerialWorker(
    IOptions<WMBusOptions> options,
    IBus bus,
    ILogger<WMBusSerialWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var opts = options.Value;

        while (!stoppingToken.IsCancellationRequested)
        {
            using var port = new SerialPort(opts.SerialPort, opts.BaudRate)
            {
                ReadTimeout = 1000
            };

            try
            {
                port.Open();
                logger.LogInformation("Serial port {Port} opened at {BaudRate} baud", opts.SerialPort, opts.BaudRate);

                await ReadLoopAsync(port, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Serial port error on {Port}, retrying in 5s", opts.SerialPort);
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            finally
            {
                if (port.IsOpen)
                    port.Close();
            }
        }
    }

    private async Task ReadLoopAsync(SerialPort port, CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            string line;
            try
            {
                line = port.ReadLine();
            }
            catch (TimeoutException)
            {
                continue;
            }

            // Capture timestamp as close to reception as possible
            var timestamp = DateTimeOffset.UtcNow;

            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed))
                continue;

            try
            {
                var rawMessage = trimmed.ToByteArray();
                await bus.Publish(new SensorPayload(rawMessage, timestamp), stoppingToken);
                logger.LogDebug("Published WMBus payload ({Bytes} bytes) at {Timestamp}", rawMessage.Length, timestamp);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to process serial line: {Line}", trimmed);
            }
        }
    }
}
