using service.Consumers;
using Yrki.IoT.WMBus.Parser;

namespace tests;

[TestClass]
public class WMBusFrameReaderTests
{
    private readonly Parser _parser = new();

    [TestMethod]
    public void Shall_read_afield_from_raw_wmbus_frame()
    {
        // Arrange — on-wire bytes for this sensor are little-endian BCD
        var frame = LansenFrameBuilder.Build("17191300", 1, 22.0, 50.0, 400, 30);

        // Act
        var aField = WMBusFrameReader.ReadAField(frame);

        // Assert
        Assert.AreEqual("00131917", aField);
    }

    [TestMethod]
    public void Shall_read_manufacturer_from_raw_wmbus_frame()
    {
        // Arrange — build a real Lansen frame
        var frame = LansenFrameBuilder.Build("17191300", 1, 22.0, 50.0, 400, 30);

        // Act
        var manufacturer = WMBusFrameReader.ReadManufacturer(frame);

        // Assert
        Assert.AreEqual("LAS", manufacturer);
    }

    [TestMethod]
    public void Shall_return_unknown_when_frame_is_too_short()
    {
        // Arrange
        var frame = new byte[] { 0x20, 0x44, 0x93 };

        // Act
        var aField = WMBusFrameReader.ReadAField(frame);
        var manufacturer = WMBusFrameReader.ReadManufacturer(frame);

        // Assert
        Assert.AreEqual("unknown", aField);
        Assert.AreEqual("unknown", manufacturer);
    }

    [TestMethod]
    public void Shall_read_axi_header_fields_from_frame_without_lfield()
    {
        // Arrange
        var frame = Convert.FromHexString("4409072779130008167AA700300591717CF32546F5365F28844995E1FE6E1EAC44A26ABC7AFD1AF1189A0551B28EB4BFBA6B831088965D846B2A676BE4E0");

        // Act
        var aField = WMBusFrameReader.ReadAField(frame);
        var manufacturer = WMBusFrameReader.ReadManufacturer(frame);

        // Assert
        Assert.AreEqual("00137927", aField);
        Assert.AreEqual("AXI", manufacturer);
    }

    [TestMethod]
    public void Shall_parse_axi_header_when_frame_without_lfield_is_normalized()
    {
        // Arrange
        var frame = Convert.FromHexString("4409072779130008167AA700300591717CF32546F5365F28844995E1FE6E1EAC44A26ABC7AFD1AF1189A0551B28EB4BFBA6B831088965D846B2A676BE4E0");
        var normalizedFrame = WMBusFrameReader.NormalizeFrame(frame);

        // Act
        var header = _parser.ParseHeader(normalizedFrame);

        // Assert
        Assert.AreEqual(normalizedFrame.Length, normalizedFrame[0]);
        Assert.AreEqual("00137927", header.AField);
        Assert.AreEqual("AXI", header.MField);
    }
}
