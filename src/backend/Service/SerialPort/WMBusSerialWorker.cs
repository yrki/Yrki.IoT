using System.IO.Ports;
using Contracts.Readings;
using MassTransit;
using Microsoft.Extensions.Options;
using service.Configuration;
using Yrki.IoT.WMBus.Parser.Extensions;

namespace service.Hardware;

public class WMBusSerialWorker(
    IOptions<WMBusOptions> options,
    IBus bus,
    ILogger<WMBusSerialWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var opts = options.Value;
        logger.LogInformation("WMBusSerialWorker starting — port={Port}, baudRate={BaudRate}, deviceKeys={KeyCount}",
            opts.SerialPort, opts.BaudRate, opts.DeviceKeys.Count);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                logger.LogInformation("Opening {Port}...", opts.SerialPort);

                using var stream = OpenPort(opts);
                using var reader = new StreamReader(stream);

                logger.LogInformation("Listening on {Port}", opts.SerialPort);

                await ReadLoopAsync(reader, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Error on {Port}, retrying in 5s", opts.SerialPort);
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private Stream OpenPort(WMBusOptions opts)
    {
        // Real serial devices (e.g. /dev/ttyUSB0, /dev/cu.*) → use SerialPort
        // PTY devices (e.g. /dev/ttys*) → use FileStream directly
        if (IsRealSerialDevice(opts.SerialPort))
        {
            var port = new SerialPort(opts.SerialPort, opts.BaudRate) { ReadTimeout = 1000 };
            port.Open();
            logger.LogInformation("Opened real serial device {Port} at {BaudRate} baud", opts.SerialPort, opts.BaudRate);
            return port.BaseStream;
        }

        logger.LogInformation("Opening {Port} as PTY/file stream", opts.SerialPort);
        return new FileStream(opts.SerialPort, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
    }

    private static bool IsRealSerialDevice(string portPath) =>
        portPath.Contains("/ttyUSB", StringComparison.Ordinal) ||
        portPath.Contains("/ttyACM", StringComparison.Ordinal) ||
        portPath.Contains("/cu.", StringComparison.Ordinal) ||
        portPath.Contains("/tty.", StringComparison.Ordinal);

    private async Task ReadLoopAsync(StreamReader reader, CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(stoppingToken);
            if (line is null)
            {
                logger.LogWarning("End of stream reached, reconnecting...");
                return;
            }

            var timestamp = DateTimeOffset.UtcNow;

            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed))
                continue;

            logger.LogInformation("Received serial data ({Length} chars): {Preview}",
                trimmed.Length, trimmed.Length > 40 ? trimmed[..40] + "..." : trimmed);

            try
            {
                var rawMessage = trimmed.ToByteArray();
                await bus.Publish(new SensorPayload(rawMessage, timestamp), stoppingToken);
                logger.LogInformation("Published WMBus payload ({Bytes} bytes)", rawMessage.Length);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to process serial line: {Line}", trimmed);
            }
        }
    }
}
