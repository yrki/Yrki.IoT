using service.Consumers;
using Yrki.IoT.WMBus.Parser.Manufacturers.Axioma.Payloads;
using Yrki.IoT.WMBus.Parser.Manufacturers.Lansen.Payloads;

namespace tests;

[TestClass]
public class SensorReadingMapperTests
{
    [TestMethod]
    public void Shall_map_axioma_payload_using_positive_volume_when_total_volume_is_missing()
    {
        // Arrange
        var payload = new Axioma_Qalcosonic_WaterMeter
        {
            PositiveVolume = 123.45,
            NegativeVolume = 0.12,
            Flow = 456,
            Temperature = 12.3,
            OnDate = 861545491,
            OnTime = 1337,
            RemainingBatteryCapacity = 87,
            ErrorCode = 0,
            ErrorFreeTime = 3600,
            LastMonthVolume = 120.0
        };
        var timestamp = DateTimeOffset.UtcNow;

        // Act
        var readings = SensorReadingMapper.Map(
            "00148057",
            new WMBusMessageMetadata("AXI", "Water"),
            payload,
            timestamp);

        // Assert
        Assert.AreEqual(12, readings.Count);
        AssertReading(readings, "TotalVolume", 123.45m);
        AssertReading(readings, "PositiveVolume", 123.45m);
        AssertReading(readings, "NegativeVolume", 0.12m);
        AssertReading(readings, "LastMonthVolume", 120m);
        AssertReading(readings, "Flow", 456m);
        AssertReading(readings, "Temperature", 12.3m);
        AssertReading(readings, "OnDate", 861545491m);
        AssertReading(readings, "OnTime", 1337m);
        AssertReading(readings, "RemainingBattery", 87m);
        AssertReading(readings, "AlarmCode", 0m);
        AssertReading(readings, "HasAlarm", 0m);
        AssertReading(readings, "ErrorFreeTimeSeconds", 3600m);
    }

    [TestMethod]
    public void Shall_map_axioma_alarm_flag_when_error_code_is_present()
    {
        // Arrange
        var payload = new Axioma_Qalcosonic_WaterMeter
        {
            ErrorCode = 5
        };
        var timestamp = DateTimeOffset.UtcNow;

        // Act
        var readings = SensorReadingMapper.Map(
            "00148057",
            new WMBusMessageMetadata("AXI", "Water"),
            payload,
            timestamp);

        // Assert
        Assert.AreEqual(2, readings.Count);
        AssertReading(readings, "AlarmCode", 5m);
        AssertReading(readings, "HasAlarm", 1m);
    }

    [TestMethod]
    public void Shall_map_all_numeric_lansen_payload_fields()
    {
        // Arrange
        var payload = new LansenE2_CO2_S
        {
            TemperatureLastMeasuredValue = 23.92,
            TemperatureAverageLastHour = 23.12,
            TemperatureAverageLast24Hours = 22.57,
            HumidityLastMeasuredValue = 31,
            HumidityAverageLastHour = 33.4,
            HumidityAverageLast24Hours = 32.8,
            CO2LastMeasuredValue = 427,
            CO2AverageLastHour = 521,
            CO2AverageLast24Hours = 1955,
            CO2LastUsedCalibrationValue = 2718,
            CO2MinutesToNextCalibration = 1299,
            SoundLevelLastMeasuredValue = 45,
            SoundLevelAverageLastHour = 52,
            OnTimeInDays = 3,
            OperatingTimeInDays = 2,
            ProductVersion = 60,
        };
        var timestamp = DateTimeOffset.UtcNow;

        // Act
        var readings = SensorReadingMapper.Map(
            "00131917",
            new WMBusMessageMetadata("LAS", "CarbonDioxide"),
            payload,
            timestamp);

        // Assert
        Assert.AreEqual(16, readings.Count);
        AssertReading(readings, "Temperature", 23.92m);
        AssertReading(readings, "TemperatureAverageLastHour", 23.12m);
        AssertReading(readings, "TemperatureAverageLast24Hours", 22.57m);
        AssertReading(readings, "Humidity", 31m);
        AssertReading(readings, "HumidityAverageLastHour", 33.4m);
        AssertReading(readings, "HumidityAverageLast24Hours", 32.8m);
        AssertReading(readings, "CO2", 427m);
        AssertReading(readings, "CO2AverageLastHour", 521m);
        AssertReading(readings, "CO2AverageLast24Hours", 1955m);
        AssertReading(readings, "CO2LastUsedCalibrationValue", 2718m);
        AssertReading(readings, "CO2MinutesToNextCalibration", 1299m);
        AssertReading(readings, "Sound", 45m);
        AssertReading(readings, "SoundAverageLastHour", 52m);
        AssertReading(readings, "OnTimeInDays", 3m);
        AssertReading(readings, "OperatingTimeInDays", 2m);
        AssertReading(readings, "ProductVersion", 60m);
    }

    private static void AssertReading(
        IReadOnlyCollection<Core.Models.SensorReading> readings,
        string sensorType,
        decimal expectedValue)
    {
        var reading = readings.Single(r => r.SensorType == sensorType);
        Assert.AreEqual(expectedValue, reading.Value);
    }
}
