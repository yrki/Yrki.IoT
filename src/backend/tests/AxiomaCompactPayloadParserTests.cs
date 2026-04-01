using service.Consumers;
using Yrki.IoT.WMBus.Parser.Extensions;

namespace tests;

[TestClass]
public class AxiomaCompactPayloadParserTests
{
    private const string TestKeyEnvironmentVariable = "AXIOMA_TEST_KEY";

    [TestMethod]
    public void Shall_parse_compact_axioma_payload_into_readings()
    {
        // Arrange
        var encryptionKey = Environment.GetEnvironmentVariable(TestKeyEnvironmentVariable);
        if (string.IsNullOrWhiteSpace(encryptionKey))
        {
            Assert.Inconclusive($"Set {TestKeyEnvironmentVariable} to run this test.");
        }

        var rawMessage = WMBusFrameReader.NormalizeFrame(
            "4409076879140008167AD6003005043A81C4E9F1E30B468385D90AAD0F368C76454A106B2DB2BF5C7E5153D8C9348BB1B62688CF4C94F9BB5451B28BD1E7"
                .ToByteArray());
        var timestamp = DateTimeOffset.UtcNow;

        // Act
        var readings = AxiomaCompactPayloadParser.Parse(
            rawMessage,
            "00147968",
            "AXI",
            timestamp,
            encryptionKey);

        // Assert
        Assert.AreEqual(4, readings.Count);
        AssertReading(readings, "TotalVolume", 708.822m);
        AssertReading(readings, "PositiveVolume", 708.822m);
        AssertReading(readings, "NegativeVolume", 0m);
        AssertReading(readings, "Flow", 0m);
    }

    private static void AssertReading(
        IReadOnlyCollection<Core.Models.SensorReading> readings,
        string sensorType,
        decimal expectedValue)
    {
        var reading = readings.Single(r => r.SensorType == sensorType);
        Assert.AreEqual(expectedValue, Math.Round(reading.Value, 3));
    }
}
