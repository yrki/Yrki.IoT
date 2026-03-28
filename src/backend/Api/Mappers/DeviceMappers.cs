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
                Name = device.Name,
                UniqueId = device.UniqueId,
                Type = Enum.Parse<global::Contracts.DeviceType>(device.Type.ToString(), false),
                Manufacturer = device.Manufacturer,
                IsNew = device.IsNew,
                LocationId = device.LocationId,
                Description = device.Description,
                LastContact = device.LastContact,
                InstallationDate = device.InstallationDate,
            };
        }

        public static Device MapToEntity(this global::Contracts.Device device)
        {
            return new Device
            {
                Id = device.Id,
                Name = device.Name,
                UniqueId = device.UniqueId,
                Type = Enum.Parse<DeviceType>(device.Type.ToString(), false),
                Manufacturer = device.Manufacturer,
                IsNew = device.IsNew,
                LocationId = device.LocationId,
                Description = device.Description,
                LastContact = device.LastContact,
                InstallationDate = device.InstallationDate,
            };
        }
    }
}
