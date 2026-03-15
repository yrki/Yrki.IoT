using Core.Models;

namespace Api.Mappers
{
    public static class DeviceMappers
    {

        public static IEnumerable<global::Contracts.Device> MapToModel(this List<Device> devices)
        {
            return devices.Select(d => d.MapToModel());
        }

        public static global::Contracts.Device MapToModel(this Device device)
        {
            return new global::Contracts.Device
            {
                Id = device.Id,
                UniqueId = device.UniqueId,
            };
        }
    }
}
