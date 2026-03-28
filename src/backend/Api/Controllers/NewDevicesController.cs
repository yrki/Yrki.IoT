using Contracts.Requests;
using Core.Features.Devices.Command;
using Core.Features.Devices.Query;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class NewDevicesController(
    NewDevicesQueryHandler queryHandler,
    UpdateDeviceCommandHandler commandHandler) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetNewDevices(CancellationToken cancellationToken)
    {
        var devices = await queryHandler.HandleAsync(cancellationToken);
        return Ok(devices);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateDevice(
        Guid id,
        [FromBody] UpdateDeviceRequest request,
        CancellationToken cancellationToken)
    {
        var result = await commandHandler.HandleAsync(id, request, cancellationToken);
        if (result is null)
            return NotFound();

        return Ok(result);
    }
}
