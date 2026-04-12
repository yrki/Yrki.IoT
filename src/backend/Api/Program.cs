using System.Text;
using System.Text.Json.Serialization;
using Api.Configuration;
using Api.Hubs;
using Api.Services;
using Core.Contexts;
using Core.Features.Devices.Command;
using Core.Features.Devices.Query;
using Core.Features.EncryptionKeys.Command;
using Core.Features.EncryptionKeys.Query;
using Core.Features.Locations.Command;
using Core.Features.Locations.Query;
using Core.Features.RawPayloads.Query;
using Core.Features.SensorData.Query;
using Core.Features.Sensors.Command;
using Core.Features.Sensors.Query;
using Core.Features.Users.Command;
using Core.Features.Users.Query;
using Core.Services.Email;
using Core.Services.Encryption;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);

builder.Services.Configure<CorsOptions>(builder.Configuration.GetSection("Cors"));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<MagicLinkOptions>(builder.Configuration.GetSection("MagicLink"));

builder.Services.AddDbContext<DatabaseContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DatabaseConnectionString")));

builder.Services.AddScoped<SensorReadingsQueryHandler>();
builder.Services.AddScoped<NewDevicesQueryHandler>();
builder.Services.AddScoped<UpdateDeviceCommandHandler>();
builder.Services.AddScoped<AssignDevicesToLocationCommandHandler>();
builder.Services.AddScoped<ImportDevicesCommandHandler>();
builder.Services.AddScoped<AllSensorsQueryHandler>();
builder.Services.AddScoped<AllGatewaysQueryHandler>();
builder.Services.AddScoped<SensorsByLocationQueryHandler>();
builder.Services.AddScoped<SensorsBySensorLocationQueryHandler>();
builder.Services.AddScoped<SensorByUniqueIdQueryHandler>();
builder.Services.AddScoped<DeleteSensorCommandHandler>();
builder.Services.AddScoped<RawPayloadsQueryHandler>();
builder.Services.AddScoped<LocationsQueryHandler>();
builder.Services.AddScoped<CreateLocationCommandHandler>();
builder.Services.AddScoped<UpdateLocationCommandHandler>();
builder.Services.AddScoped<DeleteLocationCommandHandler>();
builder.Services.AddScoped<EncryptionKeysQueryHandler>();
builder.Services.AddScoped<CreateEncryptionKeyCommandHandler>();
builder.Services.AddScoped<UpdateEncryptionKeyCommandHandler>();
builder.Services.AddScoped<DeleteEncryptionKeyCommandHandler>();
builder.Services.AddScoped<UsersQueryHandler>();
builder.Services.AddScoped<CreateUserCommandHandler>();
builder.Services.AddScoped<UpdateUserCommandHandler>();
builder.Services.AddScoped<DeleteUserCommandHandler>();

var encryptionMasterKey = builder.Configuration["Encryption:MasterKey"]
    ?? throw new InvalidOperationException("Encryption:MasterKey must be configured.");
builder.Services.AddSingleton<IKeyEncryptionService>(new AesKeyEncryptionService(encryptionMasterKey));
builder.Services.AddScoped<ITokenHasher, Sha256TokenHasher>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IMagicLinkService, MagicLinkService>();

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtOptions.Issuer,
        ValidAudience = jwtOptions.Audience,
        IssuerSigningKey = signingKey,
        ClockSkew = TimeSpan.FromMinutes(1)
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options => options.AddPolicy("CorsPolicy", policy =>
    {
        var corsOptions = builder.Configuration.GetSection("Cors").Get<CorsOptions>() ?? new CorsOptions();
        if (corsOptions.AllowedOrigins.Length == 0)
        {
            throw new InvalidOperationException("Cors:AllowedOrigins must contain at least one origin.");
        }

        policy.WithOrigins(corsOptions.AllowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    }));

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSignalR();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var databaseContext = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
    databaseContext.Database.Migrate();

    var adminEmail = app.Configuration["Admin:Email"];
    if (!string.IsNullOrWhiteSpace(adminEmail))
    {
        var normalizedEmail = adminEmail.Trim().ToUpperInvariant();
        var exists = await databaseContext.Users.AnyAsync(u => u.NormalizedEmail == normalizedEmail);
        if (!exists)
        {
            databaseContext.Users.Add(new Core.Models.AppUser
            {
                Id = Guid.NewGuid(),
                Email = adminEmail.Trim(),
                NormalizedEmail = normalizedEmail,
                CreatedAtUtc = DateTime.UtcNow,
            });
            await databaseContext.SaveChangesAsync();
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("CorsPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<SensorHub>("/hubs/sensors");
app.Run();
