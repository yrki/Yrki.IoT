using Core.Models;

namespace Api.Mappers
{
    public static class DeviceMappers
    {

        public static IEnumerable<Contracts.Device> MapToModel(this List<Device> devices)
        {
            return devices.Select(d => d.MapToModel());
        }

        public static Contracts.Device MapToModel(this Device device)
        {
            return new Contracts.Device
            {
                Id = device.Id,
                UniqueId = device.UniqueId,
            };
        }
    }
}