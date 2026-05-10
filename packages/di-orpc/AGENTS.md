# @ultranomic/di-orpc

ORPC adapter for @ultranomic/di. Bridges the DI container with ORPC type-safe RPC.

## Package Overview

`@ultranomic/di-orpc` connects `@ultranomic/di` to the ORPC type-safe RPC framework. It provides router composition, middleware wiring, and service resolution within the DI container. When used alongside `@ultranomic/di-hono`, it integrates ORPC routes into the Hono HTTP pipeline.

Scope: ORPC router registration, middleware composition, request-scoped service resolution, error handling bridge.
Not in scope: DI container mechanics, service scope definitions, dependency graph building. Those belong in `@ultranomic/di`.

## Architecture

| File                          | Purpose                                                                                                                                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types.ts`                | Public type definitions for ORPC integration: router config, middleware types, service types, module options.                                                                                                                                               |
| `src/orpc-router.ts`          | ORPC router factory. Composes procedures into a type-safe router instance registered in the DI container.                                                                                                                                                   |
| `src/orpc-middleware.ts`      | ORPC middleware factory. Creates DI-aware middleware that resolves services from the container within each request scope.                                                                                                                                   |
| `src/orpc-module.ts`          | `OrpcModule()` factory. Standalone infrastructure module that provides and exports `OrpcService`. Accepts optional config (prefix, plugins, errorInterceptor, options factory). Compose via `imports` on `Module`.                                          |
| `src/orpc-service.ts`         | `OrpcService` singleton injectable. Lazily builds the ORPC router on first access. Walks module tree to find `OrpcModuleClass` for options and detect `HonoModule` for auto-mounting. Discovers procedures from providers, wires middleware, mounts routes. |
| `src/orpc-request-context.ts` | `ORPCRequestContext` const object wrapping `AsyncLocalStorage`. Stores the ORPC context per request. `get()` retrieves current context, `run()` sets it.                                                                                                    |
| `src/error-interceptor.ts`    | `errorInterceptor` function. Maps `DIError` to ORPC error codes, delegates ORPC errors to built-in handling, re-throws unknown errors.                                                                                                                      |
| `src/index.ts`                | Barrel exports.                                                                                                                                                                                                                                             |

Data flow: `OrpcModule()` provides `OrpcService` and stores module options. When `orpcService.handler` is first accessed, `OrpcService` walks the module tree to find the `OrpcModuleClass` for options, discovers procedure providers from `container.sorted`, resolves them, composes the router, and wires middleware. If a `HonoModule` is found anywhere in the module tree, ORPC routes are auto-mounted on the Hono app. Each procedure runs inside a container request scope with `OrpcRequestContext` set, giving request-scoped services access to the ORPC context.

## Conventions

- `AppModule` should extend `Module({ imports: [...] })`, importing `OrpcModule()` and feature modules. Do NOT extend `OrpcModule` directly. Routers go in feature modules or directly as providers on `AppModule`.
- `OrpcModule()` is standalone — it only provides `OrpcService` and ORPC config (prefix, plugins, errorInterceptor). It does NOT accept providers/exports/imports.
- Use `InferOrpcRouterTree<typeof AppModule>` to extract the typed router tree for client-side type inference via `RouterClient<AppRouter>`.
- Use `as const` for enum-like objects (required by `erasableSyntaxOnly: true`). No `enum` keyword.
- Use `#` private fields, not `private` keyword.
- Use `type` over `interface`.
- Use `export type` for type-only exports (required by `verbatimModuleSyntax: true`).
- Constructor injection only. Dependencies arrive as constructor parameters in the order declared in `inject` on the config.
- Test file sits next to source file: `foo.ts` -> `foo.test.ts`.

## Testing

Run tests:

```bash
cd libs/di-orpc
pnpm test
```

Coverage requirement: 100%. Every source file has a corresponding `.test.ts` file in the same directory.

Tests use vitest. Write tests first (TDD).

## Guardrails

- No decorators. No `reflect-metadata`. Use mixin factories with static metadata.
- No `enum` keyword. Use `as const` objects (required by `erasableSyntaxOnly: true`).
- No `interface` keyword. Use `type` aliases.
- No `private` keyword. Use `#` private fields.
- No parameter properties (e.g., `constructor(private x: X)`). Use explicit field declarations.
- No `AppError` usage. Error handling maps `DIError` to ORPC errors only.
- No validation library deps in source files. Validation schemas are defined at the usage site.
- No server lifecycle management. `OrpcService` does not start/stop a server.
- No client-side code. This package is server-only.

## Build Commands

```bash
cd libs/di-orpc
pnpm build:lib      # Production build (tsgo --noCheck)
pnpm build:dev      # Dev build with declarations and source maps
pnpm typecheck       # Type check without emitting
pnpm test            # Run tests once
pnpm test:dev        # Run tests in watch mode
```

## Dependencies

Runtime dependencies: `@ultranomic/di` (workspace).

Peer dependencies: `@orpc/server` (^1.14.0), `@ultranomic/di-hono` (workspace, optional — needed only when mounting ORPC on Hono).

Dev dependencies: vitest, typescript, zod (test fixtures only). See `package.json` for the full list.

## Related Packages

- `@ultranomic/di` (see `libs/di/AGENTS.md`): Core DI container. Provides `Injectable`, `Module`, `Container`, `Scope` primitives that this package builds on.
- `@ultranomic/di-hono` (see `libs/di-hono/AGENTS.md`): Hono adapter. Optional peer dependency for mounting ORPC routes on Hono.
