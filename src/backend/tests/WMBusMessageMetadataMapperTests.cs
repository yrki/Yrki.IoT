using service.Consumers;
using Yrki.IoT.WMBus.Parser;
using ParserDeviceType = Yrki.IoT.WMBus.Parser.DeviceType;

namespace tests;

[TestClass]
public class WMBusMessageMetadataMapperTests
{
    private readonly Parser _parser = new();

    [TestMethod]
    public void Shall_map_manufacturer_and_device_type_from_lansen_header()
    {
        // Arrange
        var frame = LansenFrameBuilder.Build("67000100", 7, 22.3, 48.1, 930, 37);
        var header = _parser.ParseHeader(frame);

        // Act
        var metadata = WMBusMessageMetadataMapper.Map(header);

        // Assert
        Assert.AreEqual("LAS", metadata.Manufacturer);
        Assert.AreEqual("CarbonDioxide", metadata.DeviceType);
    }

    [TestMethod]
    public void Shall_return_unknown_for_unmapped_parser_device_types()
    {
        // Arrange
        var parserDeviceType = ParserDeviceType.SystemDevice1;

        // Act
        var result = WMBusMessageMetadataMapper.MapDeviceType(parserDeviceType);

        // Assert
        Assert.AreEqual("SystemDevice1", result);
    }
}
