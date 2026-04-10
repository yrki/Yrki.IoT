namespace Simulator;

public sealed class SimulatedWaterMeter
{
    public required string SensorId { get; init; }
    public required string? GatewayId { get; init; }
    public required decimal TotalVolume { get; set; }
    public required decimal NegativeVolume { get; init; }
    public required int FlowBase { get; init; }
    public required int FlowVariance { get; init; }
    public required int BurstEvery { get; init; }
    public required int BurstOffset { get; init; }
}
