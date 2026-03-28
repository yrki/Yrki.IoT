# CLAUDE.md

@AGENTS.md

## Common Commands

### Build and test
```bash
dotnet build Yrki.IoT.slnx          # build entire solution
dotnet test Yrki.IoT.slnx           # run all tests
dotnet test src/backend/tests/tests.csproj  # run backend unit tests only
```

### Run locally (outside Docker)
```bash
dotnet run --project src/backend/Api/Api.csproj     # API on http://localhost:5180
dotnet run --project src/backend/Service/Service.csproj  # background service
```

### Frontend
```bash
cd src/frontend
npm install          # install dependencies
npm run dev          # dev server on http://localhost:5173
npm test             # run tests (vitest)
npm run openapi:types  # regenerate TypeScript types from backend OpenAPI
```

### Docker
```bash
docker-compose up                        # start all services
./start-infrastructure.sh               # start only postgres + rabbitmq
./start-backend.sh                      # build, test, then start backend + infra
MAGIC_LINK_FRONTEND_BASE_URL=http://localhost:5173 docker-compose up --build postgres rabbitmq api service
```

## Project Structure

```
Yrki.IoT/
├── AGENTS.md                    # shared agent/AI coding guidelines
├── CLAUDE.md                    # Claude Code entry point (this file)
├── docker-compose.yml
├── Yrki.IoT.slnx
├── src/
│   ├── backend/
│   │   ├── Api/                 # ASP.NET Core Web API (port 5180/8081)
│   │   ├── Core/                # Domain models, EF Core context, migrations
│   │   ├── Contracts/           # Shared message contracts (RabbitMQ)
│   │   ├── Service/             # Background worker service
│   │   └── tests/               # Unit tests
│   └── frontend/
│       └── src/
│           ├── features/        # Feature-sliced UI code
│           ├── api/             # Generated OpenAPI types + fetch clients
│           ├── auth/
│           └── components/      # Shared UI primitives
└── volumes/                     # Docker volume mounts (postgres, rabbitmq)
```

## Key Ports (local dev)

| Service        | Port  |
|----------------|-------|
| API (dotnet)   | 5180  |
| API (Docker)   | 8081  |
| Frontend (Vite)| 5173  |
| PostgreSQL     | 5432  |
| RabbitMQ AMQP  | 5672  |
| RabbitMQ UI    | 15672 |
| Swagger (local)| http://localhost:5180/swagger |
