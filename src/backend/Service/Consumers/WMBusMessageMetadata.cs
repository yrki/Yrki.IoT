using Core.Models;

namespace service.Consumers;

public record WMBusMessageMetadata(
    string Manufacturer,
    string DeviceType);
