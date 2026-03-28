# Frontend — CLAUDE.md

See root [CLAUDE.md](../../CLAUDE.md) and [AGENTS.md](../../AGENTS.md) for project-wide guidelines.

## Commands

```bash
cd src/frontend

npm install                 # install dependencies
npm run dev                 # dev server → http://localhost:5173
npm run build               # production build
npm test                    # run tests once (vitest)
npm run test:watch          # run tests in watch mode

# Regenerate TypeScript types from backend OpenAPI (requires API running on :5180)
npm run openapi:types

# Check that generated types exist
npm run openapi:types:check
```

## Project Layout

```
src/frontend/src/
├── features/           # Feature slices — each owns components, hooks, API, tests
├── api/
│   └── generated/      # Auto-generated OpenAPI TypeScript types (do not hand-edit)
├── auth/               # Authentication feature
├── components/         # Shared UI primitives (only genuinely reusable things)
└── styles/
```

## Key Technologies

- React 18, TypeScript — UI framework
- Vite — dev server and bundler
- Vitest + React Testing Library — unit/component tests
- openapi-typescript — generates types from backend Swagger

## Generated API Types

Types live in `src/api/generated/openapi.ts` — **never edit by hand**.
Regenerate after any backend contract change:

```bash
# With backend running locally on :5180
npm run openapi:types

# With custom backend URL
OPENAPI_URL=http://localhost:8081/swagger/v1/swagger.json npm run openapi:types
```

Source of truth: `http://localhost:5180/swagger/v1/swagger.json` (local) or `http://localhost:8081/swagger/v1/swagger.json` (Docker).
