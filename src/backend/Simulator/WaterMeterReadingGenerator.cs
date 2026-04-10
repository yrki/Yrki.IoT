using Contracts.Readings;

namespace Simulator;

public static class WaterMeterReadingGenerator
{
    public static IReadOnlyList<SensorReadingReceived> CreateReadings(
        SimulatedWaterMeter meter,
        DateTimeOffset timestamp,
        int tick)
    {
        var flow = CalculateFlow(meter, tick);
        var positiveIncrement = Math.Round((decimal)flow / 72000m, 3, MidpointRounding.AwayFromZero);
        meter.TotalVolume = Math.Round(meter.TotalVolume + positiveIncrement, 3, MidpointRounding.AwayFromZero);

        var onDate = new decimal(timestamp.ToUnixTimeSeconds());
        var positiveVolume = meter.TotalVolume + meter.NegativeVolume;

        return
        [
            new(meter.SensorId, "Flow", "AXI", flow, timestamp, meter.GatewayId, null),
            new(meter.SensorId, "NegativeVolume", "AXI", meter.NegativeVolume, timestamp, meter.GatewayId, null),
            new(meter.SensorId, "OnDate", "AXI", onDate, timestamp, meter.GatewayId, null),
            new(meter.SensorId, "PositiveVolume", "AXI", positiveVolume, timestamp, meter.GatewayId, null),
            new(meter.SensorId, "TotalVolume", "AXI", meter.TotalVolume, timestamp, meter.GatewayId, null),
        ];
    }

    private static decimal CalculateFlow(SimulatedWaterMeter meter, int tick)
    {
        var baseFlow = meter.FlowBase + (tick % 5) * (meter.FlowVariance / 6m);
        if ((tick + meter.BurstOffset) % meter.BurstEvery == 0)
        {
            return Math.Round(baseFlow + meter.FlowVariance, 3, MidpointRounding.AwayFromZero);
        }

        return Math.Round(baseFlow, 3, MidpointRounding.AwayFromZero);
    }
}
