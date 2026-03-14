using Core.Contexts;

using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContext<DatabaseContext>(options => 
                                            options.UseNpgsql(builder.Configuration.GetConnectionString("DatabaseConnectionString")));

// Add cors policy for localhost
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy",
               builder => builder
                          .AllowAnyMethod()
                          .AllowAnyHeader()
                          .AllowAnyOrigin());
});

builder.Services.AddControllers();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}


// app.UseHttpsRedirection();

app.UseCors("CorsPolicy");

app.UseAuthorization();

app.MapControllers();

app.Run();
