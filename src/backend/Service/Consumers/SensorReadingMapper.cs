using Yrki.IoT.WMBus.Parser;
using Yrki.IoT.WMBus.Parser.Manufacturers.Axioma.Payloads;
using Yrki.IoT.WMBus.Parser.Manufacturers.Lansen.Payloads;

namespace service.Consumers;

public static class SensorReadingMapper
{
    public static List<Core.Models.SensorReading> Map(WMBusMessage header, IParsedPayload payload, DateTimeOffset timestamp) =>
        payload switch
        {
            LansenE2_CO2_S co2 => MapLansenCO2(header.AField, co2, timestamp),
            Axioma_Qalcosonic_WaterMeter water => MapAxiomaWaterMeter(header.AField, water, timestamp),
            _ => []
        };

    private static List<Core.Models.SensorReading> MapLansenCO2(string sensorId, LansenE2_CO2_S payload, DateTimeOffset timestamp) =>
        Readings(timestamp, sensorId,
            ("Temperature", payload.TemperatureLastMeasuredValue),
            ("Humidity", payload.HumidityLastMeasuredValue),
            ("CO2", payload.CO2LastMeasuredValue),
            ("Sound", payload.SoundLevelLastMeasuredValue));

    private static List<Core.Models.SensorReading> MapAxiomaWaterMeter(string sensorId, Axioma_Qalcosonic_WaterMeter payload, DateTimeOffset timestamp) =>
        Readings(timestamp, sensorId,
            ("TotalVolume", payload.TotalVolume),
            ("Flow", payload.Flow.HasValue ? (double?)payload.Flow.Value : null),
            ("Temperature", payload.Temperature),
            ("RemainingBattery", payload.RemainingBatteryCapacity.HasValue ? (double?)payload.RemainingBatteryCapacity.Value : null));

    private static List<Core.Models.SensorReading> Readings(DateTimeOffset timestamp, string sensorId, params (string Type, double? Value)[] measurements) =>
        measurements
            .Where(m => m.Value.HasValue)
            .Select(m => new Core.Models.SensorReading
            {
                Timestamp = timestamp,
                SensorId = sensorId,
                SensorType = m.Type,
                Value = (decimal)m.Value!.Value
            })
            .ToList();
}
