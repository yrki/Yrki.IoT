using Microsoft.AspNetCore.SignalR;

namespace Api.Hubs;

public class SensorHub : Hub
{
    public async Task SendReading(object reading)
    {
        await Clients.Others.SendAsync("SensorReadingReceived", reading);
    }
}
