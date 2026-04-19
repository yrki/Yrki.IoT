# AGENTS.md

This repository should evolve as a modern, production-quality codebase across both .NET backend services and React frontend applications.

## Intent

- Keep the project language in English for code, comments, tests, documentation, commit messages, and public API names.
- Prefer the latest stable C# and .NET language/runtime features that are appropriate for the repository.
- Optimize for maintainability, fast feedback, and safe incremental change.
- Favor choices consistent with Dave Farley's continuous delivery principles: small changes, high cohesion, low coupling, clear boundaries, and strong automated verification.

## Design Principles

- Keep methods short and focused on a single responsibility.
- Prefer composition over inheritance.
- Separate domain logic from I/O, framework code, serial port access, and timing concerns.
- Design for testability first: isolate side effects behind small interfaces.
- Make invalid states hard to represent.
- Prefer explicit names over clever code.
- Remove dead code, commented-out code, and temporary debugging output unless there is a clear short-term reason to keep it.

## Architecture

- Keep a thin outer layer for hardware, serial communication, configuration, and runtime wiring.
- Keep parsing, protocol handling, validation, and message processing in pure units that can be tested without devices.
- Introduce small abstractions around `SerialPort`, clocks, delays, and background execution when needed for deterministic tests.
- Use dependency injection through constructors for non-trivial collaborators.
- Avoid static mutable state.
- Organize both backend and frontend around vertical slices by feature, not broad technical layers.
- Prefer feature folders where each feature owns its UI, application logic, domain rules, API integration, and tests as appropriate.
- Keep shared code genuinely shared. Do not create generic `helpers`, `services`, or `components` folders as a default dumping ground.
- Backend slices should keep transport, orchestration, and domain behavior close together while still isolating infrastructure and framework boundaries.
- Frontend slices should keep React components, hooks, route handlers, state, API clients, and feature tests together when they serve the same user-facing capability.
- Allow a small shared area for cross-cutting primitives, design-system components, and infrastructure code, but keep feature-specific logic inside the owning feature folder.

## Frontend React Guidance

- Prefer modern React with functional components, hooks, and clear data flow.
- Keep components small and focused. Split presentation from data-loading and side effects when that improves clarity and testability.
- Co-locate feature-specific components, hooks, API calls, schemas, and tests inside the relevant feature folder.
- Prefer composition over large container components or global state by default.
- Introduce shared UI primitives only after at least two concrete feature use cases justify them.
- Keep routing shallow and map routes to feature folders where practical.
- Treat server state, forms, and client state as separate concerns. Do not combine them in one abstraction unless there is a clear benefit.
- Avoid spreading business rules across components. Move non-trivial logic into testable functions, hooks, or feature services.
- Use strong TypeScript types generated from the backend OpenAPI specification for request and response contracts.
- Do not hand-maintain frontend API models when the backend contract can be generated.
- Keep generated API types in a clearly marked location and treat the backend OpenAPI document as the source of truth.
- Add and maintain a frontend `package.json` script that fetches the backend OpenAPI specification and regenerates TypeScript types.

## Coding Style

- Use nullable reference types and treat warnings as design feedback.
- Prefer async/await and cancellation-aware APIs for I/O and long-running operations.
- Prefer immutable models and `readonly` fields where practical.
- Use guard clauses and early returns to keep control flow simple.
- Keep classes small. Split responsibilities instead of growing large service classes.
- Comments should explain intent or constraints, not restate the code.

## Testing

- Always create unit tests alongside new functionality — never skip tests.
- Add or update unit tests for every behavior change.
- Add tests for all API calls.
- Use descriptive test names in the format `Shall_open_a_file`.
- Structure tests with explicit `// Arrange`, `// Act`, and `// Assert` sections.
- Keep unit tests deterministic, isolated, and fast.
- Prefer pure unit tests over integration tests when validating logic.
- Add integration tests only where hardware, protocol boundaries, or adapter behavior justify them.
- Mock only true boundaries. Prefer fakes or simple test doubles over heavy mocking.

## Change Strategy

- Make the smallest safe change that improves the design.
- Refactor opportunistically when touching code, but keep changes incremental.
- Preserve backward compatibility unless the task explicitly allows breaking changes.
- When introducing new abstractions, ensure they remove coupling or improve testability rather than adding ceremony.

## Practical Guidance For This Repository

- Keep sample application code separate from reusable library code.
- Avoid embedding protocol parsing directly inside serial port loops.
- Move byte parsing and frame assembly into dedicated, testable components.
- Ensure long-running listeners can stop cleanly via `CancellationToken`.
- Dispose `IDisposable` resources deterministically.
- Prefer structures such as `src/Features/<FeatureName>/...` on the frontend and equivalent feature-oriented folders on the backend.
- Within a feature folder, allow subfolders only when they support the slice, for example `Components`, `Hooks`, `Api`, `Domain`, `Application`, and `Tests`.
- Do not split the codebase first by type across the whole app, such as global `Controllers`, `Services`, `Hooks`, or `Components`, when the code belongs to a specific feature.
- For the current frontend, keep an action in `src/frontend/package.json` that regenerates types from the backend Swagger endpoint, for example from `http://localhost:5180/swagger/v1/swagger.json` during local development.
