# Architecture

This repository uses a vertical-slice architecture.

The main rule is simple:

- Organize code by feature.
- Keep each feature's flow as self-contained as possible.
- Prefer clean pipes per feature over premature code reuse.

## Goal

Each user-facing or domain-facing capability should have its own clear pipeline from entry point to domain behavior to persistence or external I/O.

That means:

- A feature should be easy to find, understand, test, and change in isolation.
- Logic should stay close to the feature that owns it.
- Shared abstractions should be introduced late, not early.
- Small duplication is acceptable when it preserves a cleaner feature boundary.

## Backend Structure

Backend features belong under `src/backend/Core/Features`.

Example:

```text
src/backend/Core/
  Features/
    Devices/
      Command/
      Query/
    Locations/
      Command/
      Query/
```

Each backend feature should keep its own:

- commands
- queries
- handlers
- validators
- mappings
- feature-specific models or DTOs
- tests when practical

Avoid moving feature code into global folders unless the code is truly cross-cutting and stable.

## Frontend Structure

Frontend features belong under `src/frontend/src/features`.

Example:

```text
src/frontend/src/
  features/
    devices/
    locations/
    sensors/
```

Each frontend feature should keep its own:

- components
- hooks
- routes
- api calls
- state
- feature-specific types
- tests

Do not default to global `components`, `hooks`, or `services` for feature logic. If code only serves one feature, it stays in that feature.

## Clean Pipes

"Clean pipes" means a feature flow should be direct and readable:

1. Input enters through the feature boundary.
2. The feature handles validation and orchestration locally.
3. Domain rules stay close to the feature.
4. External dependencies are pushed to the edge.

Good outcomes:

- fewer hidden dependencies
- less cross-feature coupling
- easier testing
- safer changes

## Reuse Policy

Prefer this order:

1. Keep the code inside the feature.
2. Duplicate a small amount of code if that keeps the feature independent.
3. Extract shared code only after at least two or more real use cases prove the abstraction is stable.

Avoid abstracting too early.

A shared module is justified only when it is:

- genuinely cross-cutting
- simple to understand
- cheaper than duplication
- unlikely to pull multiple features into the same dependency chain

## Allowed Shared Areas

Shared code is allowed for a small number of cases:

- infrastructure and runtime wiring
- authentication and authorization primitives
- database access foundations
- generated API contracts
- design-system primitives
- well-proven cross-cutting utilities

Shared code must stay small and should not become a dumping ground.

## Practical Rules

- Keep methods and components small.
- Keep domain logic away from framework and transport code.
- Prefer constructor injection for non-trivial collaborators.
- Use explicit names.
- Remove dead code.
- Add tests for behavior changes.
- Keep changes incremental.

## Testing

- Add or update tests for every behavior change.
- Add tests for all API calls.
- Use descriptive test names in the format `Shall_open_a_file`.
- Structure every test with explicit `// Arrange`, `// Act`, and `// Assert` sections.
- Keep tests deterministic, isolated, and fast.
- Prefer pure unit tests over integration tests when validating logic.
- Add integration tests when API boundaries, adapters, or runtime wiring justify them.

## Decision Filter

When adding code, ask:

1. Which feature owns this behavior?
2. Can this stay inside that feature?
3. Does extracting it make the pipe cleaner, or just more generic?
4. Would small duplication be safer than a shared abstraction?

If in doubt, keep the code inside the owning feature.
