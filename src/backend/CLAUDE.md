# Backend — CLAUDE.md

See root [CLAUDE.md](../../CLAUDE.md) and [AGENTS.md](../../AGENTS.md) for project-wide guidelines.

## Commands

```bash
# From repo root
dotnet build src/backend/Api/Api.csproj
dotnet build src/backend/Service/Service.csproj
dotnet test src/backend/tests/tests.csproj

# Run API locally (http://localhost:5180, swagger at /swagger)
dotnet run --project src/backend/Api/Api.csproj

# Run background service locally
dotnet run --project src/backend/Service/Service.csproj
```

## Project Layout

```
backend/
├── Api/                # ASP.NET Core Web API
│   ├── Controllers/
│   ├── Services/
│   ├── Mappers/
│   ├── Configuration/
│   └── Program.cs
├── Core/               # Domain: EF Core DbContext, models, migrations
│   ├── Contexts/
│   ├── Models/
│   ├── Migrations/
│   └── Services/
├── Contracts/          # Message contracts shared between Api and Service
└── Service/            # Worker service (RabbitMQ consumer)
    └── Worker.cs
```

## Key Technologies

- .NET 10, C# — target runtime
- ASP.NET Core — Web API host
- Entity Framework Core — PostgreSQL via Npgsql
- EasyNetQ — RabbitMQ messaging
- Azure Communication Services — email delivery
- xUnit / NSubstitute — unit tests

## Infrastructure Dependencies

- PostgreSQL 17 — connection string via `ConnectionStrings__DatabaseConnectionString`
- RabbitMQ 3 — configured via `RabbitMq__*` environment variables

## Testing

Test project: `src/backend/tests/tests.csproj`

```bash
dotnet test src/backend/tests/tests.csproj
dotnet test src/backend/tests/tests.csproj --logger "console;verbosity=detailed"
```

Test name convention: `Shall_do_something_when_condition`
Structure tests with `// Arrange`, `// Act`, `// Assert` comments.
