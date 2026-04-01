using service.Consumers;
using Simulator;

namespace tests;

[TestClass]
public class WMBusFrameReaderTests
{
    [TestMethod]
    public void Shall_read_afield_from_raw_wmbus_frame()
    {
        // Arrange — build a real Lansen frame with known address
        var frame = LansenFrameBuilder.Build("67000100", 1, 22.0, 50.0, 400, 30);

        // Act
        var aField = WMBusFrameReader.ReadAField(frame);

        // Assert
        Assert.AreEqual("67000100", aField);
    }

    [TestMethod]
    public void Shall_read_manufacturer_from_raw_wmbus_frame()
    {
        // Arrange — build a real Lansen frame
        var frame = LansenFrameBuilder.Build("67000100", 1, 22.0, 50.0, 400, 30);

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
}
