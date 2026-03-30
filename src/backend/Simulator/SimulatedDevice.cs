namespace Simulator;

public record SimulatedDevice(
    string AddressHex,
    double TemperatureMin,
    double TemperatureMax,
    double HumidityMin,
    double HumidityMax,
    int Co2Min,
    int Co2Max,
    int SoundMin,
    int SoundMax,
    double TemperaturePhase,
    double HumidityPhase,
    double Co2Phase,
    double SoundPhase);
