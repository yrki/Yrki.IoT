using Yrki.IoT.WMBus.Parser;
using Yrki.IoT.WMBus.Parser.Manufacturers.Axioma.Payloads;
using Yrki.IoT.WMBus.Parser.Manufacturers.Lansen.Payloads;

namespace service.Consumers;

public static class SensorReadingMapper
{
    public static List<Core.Models.SensorReading> Map(
        string sensorId,
        WMBusMessageMetadata metadata,
        IParsedPayload payload,
        DateTimeOffset timestamp) =>
        payload switch
        {
            LansenE2_CO2_S co2 => MapLansenCO2(sensorId, metadata.Manufacturer, co2, timestamp),
            Axioma_Qalcosonic_WaterMeter water => MapAxiomaWaterMeter(sensorId, metadata.Manufacturer, water, timestamp),
            _ => []
        };

    private static List<Core.Models.SensorReading> MapLansenCO2(
        string sensorId,
        string manufacturer,
        LansenE2_CO2_S payload,
        DateTimeOffset timestamp) =>
        Readings(timestamp, sensorId, manufacturer,
            ("Temperature", payload.TemperatureLastMeasuredValue),
            ("TemperatureAverageLastHour", payload.TemperatureAverageLastHour),
            ("TemperatureAverageLast24Hours", payload.TemperatureAverageLast24Hours),
            ("Humidity", payload.HumidityLastMeasuredValue),
            ("HumidityAverageLastHour", payload.HumidityAverageLastHour),
            ("HumidityAverageLast24Hours", payload.HumidityAverageLast24Hours),
            ("CO2", payload.CO2LastMeasuredValue),
            ("CO2AverageLastHour", payload.CO2AverageLastHour),
            ("CO2AverageLast24Hours", payload.CO2AverageLast24Hours),
            ("CO2LastUsedCalibrationValue", payload.CO2LastUsedCalibrationValue),
            ("CO2MinutesToNextCalibration", payload.CO2MinutesToNextCalibration),
            ("Sound", payload.SoundLevelLastMeasuredValue),
            ("SoundAverageLastHour", payload.SoundLevelAverageLastHour),
            ("OnTimeInDays", payload.OnTimeInDays),
            ("OperatingTimeInDays", payload.OperatingTimeInDays),
            ("ProductVersion", payload.ProductVersion));

    private static List<Core.Models.SensorReading> MapAxiomaWaterMeter(
        string sensorId,
        string manufacturer,
        Axioma_Qalcosonic_WaterMeter payload,
        DateTimeOffset timestamp)
    {
        var totalVolume = payload.TotalVolume
            ?? payload.PositiveVolume
            ?? (payload.PositiveVolume.HasValue && payload.NegativeVolume.HasValue
                ? payload.PositiveVolume.Value - payload.NegativeVolume.Value
                : null);

        return Readings(timestamp, sensorId, manufacturer,
            ("TotalVolume", totalVolume),
            ("PositiveVolume", payload.PositiveVolume),
            ("NegativeVolume", payload.NegativeVolume),
            ("LastMonthVolume", payload.LastMonthVolume),
            ("LastMonthPositiveVolume", payload.LastMonthPositiveVolume),
            ("LastMonthNegativeVolume", payload.LastMonthNegativeVolume),
            ("Flow", payload.Flow.HasValue ? (double?)payload.Flow.Value : null),
            ("Temperature", payload.Temperature),
            ("OnDate", payload.OnDate.HasValue ? (double?)payload.OnDate.Value : null),
            ("OnTime", payload.OnTime.HasValue ? (double?)payload.OnTime.Value : null),
            ("RemainingBattery", payload.RemainingBatteryCapacity.HasValue ? (double?)payload.RemainingBatteryCapacity.Value : null),
            ("AlarmCode", payload.ErrorCode.HasValue ? (double?)payload.ErrorCode.Value : null),
            ("HasAlarm", payload.ErrorCode.HasValue ? payload.ErrorCode.Value == 0 ? 0d : 1d : null),
            ("ErrorFreeTimeSeconds", payload.ErrorFreeTime.HasValue ? (double?)payload.ErrorFreeTime.Value : null));
    }

    private static List<Core.Models.SensorReading> Readings(
        DateTimeOffset timestamp,
        string sensorId,
        string manufacturer,
        params (string Type, double? Value)[] measurements) =>
        measurements
            .Where(m => m.Value.HasValue)
            .Select(m => new Core.Models.SensorReading
            {
                Timestamp = timestamp,
                SensorId = sensorId,
                Manufacturer = manufacturer,
                SensorType = m.Type,
                Value = (decimal)m.Value!.Value
            })
            .ToList();
}
