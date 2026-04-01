using service.Consumers;
using Yrki.IoT.WMBus.Parser.Manufacturers.Axioma.Payloads;

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
        Assert.AreEqual(8, readings.Count);
        AssertReading(readings, "TotalVolume", 123.45m);
        AssertReading(readings, "PositiveVolume", 123.45m);
        AssertReading(readings, "NegativeVolume", 0.12m);
        AssertReading(readings, "Flow", 456m);
        AssertReading(readings, "Temperature", 12.3m);
        AssertReading(readings, "RemainingBattery", 87m);
        AssertReading(readings, "AlarmCode", 0m);
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

    private static void AssertReading(
        IReadOnlyCollection<Core.Models.SensorReading> readings,
        string sensorType,
        decimal expectedValue)
    {
        var reading = readings.Single(r => r.SensorType == sensorType);
        Assert.AreEqual(expectedValue, reading.Value);
    }
}
