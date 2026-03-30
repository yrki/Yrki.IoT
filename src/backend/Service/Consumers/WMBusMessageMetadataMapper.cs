using Yrki.IoT.WMBus.Parser;
using ParserDeviceType = Yrki.IoT.WMBus.Parser.DeviceType;

namespace service.Consumers;

public static class WMBusMessageMetadataMapper
{
    public static WMBusMessageMetadata Map(WMBusMessage header) =>
        new(header.MField, header.DeviceType.ToString());

    public static string MapDeviceType(ParserDeviceType deviceType) => deviceType.ToString();
}
