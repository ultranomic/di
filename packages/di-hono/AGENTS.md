# @ultranomic/di-hono

Hono adapter for @ultranomic/di. Bridges the DI container with Hono routing, validation, and request scoping.

## Package Overview

`@ultranomic/di-hono` connects `@ultranomic/di` to the Hono web framework. Controllers declare routes via `this.route()` inside class initializers. `HonoModule` auto-discovers controllers from providers, wires validation middleware, and wraps every handler in a request scope. `HonoService` exposes the configured Hono app instance.

Scope: HTTP route registration, request-scoped service resolution, validation middleware wiring, error handling bridge.
Not in scope: DI container mechanics, service scope definitions, dependency graph building. Those belong in `@ultranomic/di`.

## Architecture

| File                     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types.ts`           | Public type definitions: `HttpMethod`, `StandardSchema` (Standard Schema spec), `StandardIssue`, `StandardPathSegment`, `StandardResult`, `ValidateTargets`, `RouteDefinition`, `ControllerConfig`, `ControllerClass`, `HonoModuleClass`, `HonoModuleOptions`, `HonoModuleOptionsFactory`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/controller.ts`      | `Controller()` mixin factory. Wraps `Injectable()` with `Scope.Singleton`. Adds `_path` static and `this.route()` public method for declaring routes with optional validation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/hono-module.ts`     | `HonoModule()` mixin factory. Wraps `Module()`. Auto-adds `HonoService` to providers and exports if missing. Stores `_isHonoModule` and `_honoOptions` static metadata. Exports `HonoModuleConfig` type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/hono-service.ts`    | `HonoService` singleton injectable. Eagerly builds the Hono app in `onStart` (async, post-bootstrap, `resolve()` available). Iterates `container.sorted` to find controller classes, resolves instances, collects route definitions from enumerable properties, wires validation middleware per target (json, query, param, header, form, cookie), wraps handlers in `withRequestScope` + all `RequestContext` subclass `run()` calls nested via `reduceRight`. Uses `container.module` to read HonoModule options (required `port`/`host`, optional `server` for HTTP/2 or HTTPS). In Node.js, auto-starts an HTTP server via `@hono/node-server`. Graceful shutdown via `beforeApplicationShutdown` (closes server). |
| `src/request-context.ts` | `RequestContext` mixin factory. Returns an `Injectable` subclass (singleton scope) with per-subclass `AsyncLocalStorage`. `create(c)` factory builds the typed context value from Hono's `Context`. Instance `get()` reads from ALS; static `run(c, fn)` populates it. Multiple subclasses are isolated — each has its own ALS via closure.                                                                                                                                                                                                                                                                                                                                                                            |
| `src/error-handler.ts`   | `errorHandler` function matching Hono's `ErrorHandler` signature. Maps `DIError` to 500 JSON responses, delegates `HTTPException` to Hono's built-in handling, re-throws unknown errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/index.ts`           | Barrel exports.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Data flow: `HonoModule()` registers providers and stores `_isHonoModule`/`_honoOptions` metadata. `options` is required — must include `port` and `host`. An optional `server` field supports HTTP/2 (`node:http2` `createServer`/`createSecureServer`) or HTTPS (`node:https` `createServer`). When the container starts, `HonoService.onStart` (async) reads `container.module` to find the root module class, walks the module tree, finds all controllers (classes with `_path`), resolves them from the container, collects their route properties, wires validation middleware, and mounts them on the Hono app. Then `#startServer()` starts an HTTP server via `@hono/node-server` (HTTP/1.1 by default, HTTP/2 or HTTPS if `server` option is configured). On shutdown, `beforeApplicationShutdown` closes the server before the container stops. Each handler runs inside `withRequestScope` with all `RequestContext` subclasses nested via `reduceRight` — each subclass's `run(c, fn)` populates its own `AsyncLocalStorage` before the request scope creates instances.

## Conventions

- Always use `extends Controller({...})` and `extends HonoModule({...})`. Never bypass the mixin factories. `AppModule` should extend `Module({ imports: [...] })`, not `HonoModule`. Use `HonoModule` for the HTTP-specific module (e.g. `HttpModule`), and import it into `AppModule`.
- Route definitions use `this.route()` inside class field initializers or property getters. The return value is a `RouteDefinition` object stored as an enumerable property on the controller instance.
- Validation uses the Standard Schema spec (`StandardSchema` type). No library coupling to Zod, Valibot, or others. Pass any Standard Schema compliant schema to `validate` in `this.route()`.
- Use `as const` for enum-like objects (required by `erasableSyntaxOnly: true`). No `enum` keyword.
- Use `#` private fields, not `private` keyword.
- Use `type` over `interface`.
- Use `export type` for type-only exports (required by `verbatimModuleSyntax: true`).
- Constructor injection only. Dependencies are declared as `[string, InjectableClass]` tuples in `inject` on the `Controller` config and accessed via `this.inject`.
- Test file sits next to source file: `foo.ts` -> `foo.test.ts`.

## Testing

Run tests:

```bash
cd packages/di-hono
vp test
```

Coverage requirement: 100%. Every source file has a corresponding `.test.ts` file in the same directory.

Test files:

- `controller.test.ts`
- `hono-module.test.ts`
- `hono-service.test.ts`
- `request-context.test.ts`
- `error-handler.test.ts`
- `test-helpers.ts` (shared test utilities)
- `types.ts` (no test file needed, type-only)

Tests use vitest. Write tests first (TDD).

## Common Tasks

### Adding a controller

```typescript
import { Controller } from '@ultranomic/di-hono';
import type { RouteDefinition } from '@ultranomic/di-hono';

export class UserController extends Controller({
  path: '/users',
  inject: [['userService', UserService]],
}) {
  list = this.route({
    method: 'GET',
    path: '/',
    handler: async (c) => {
      const users = await this.inject.userService.findAll();
      return c.json(users);
    },
  });
}
```

Key points:

- `inject` is an array of `[string, InjectableClass]` tuples mapping property names to injectable classes.
- Dependencies are available via `this.inject` — no manual constructor needed.
- Access dependencies via `this.inject.propertyName`.

### Adding a route with validation

```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

create = this.route({
  method: 'POST',
  path: '/',
  validate: { json: createUserSchema },
  handler: async (c) => {
    const body = c.req.valid('json');
    const user = await this.inject.userService.create(body);
    return c.json(user, 201);
  },
});
```

Any Standard Schema compliant library works natively (Zod v4, Valibot, ArkType). Pass schemas directly to `validate` — no adapter needed. The validation middleware runs before the handler, returning 400 with issues on failure.

### Using request context

```typescript
import { RequestContext } from '@ultranomic/di-hono';

// 1. Define a typed context
class AppContext extends RequestContext({
  create: (c) => ({
    user: extractUser(c.req.header('Authorization')),
    requestId: crypto.randomUUID(),
  }),
}) {}

// 2. Register in a HonoModule
class HttpModule extends HonoModule({
  providers: [AppContext],
  exports: [AppContext],
}) {}

// 3. Inject into any service
class AuditService extends Injectable({
  inject: [['ctx', AppContext]],
}) {
  log(action: string) {
    const { user, requestId } = this.inject.ctx.get()!;
  }
}
```

Each `RequestContext` subclass is an `Injectable` (singleton scope) with its own `AsyncLocalStorage`. Multiple subclasses are isolated — define as many as needed. `HonoService` discovers all `RequestContext` providers and nests their `run()` calls automatically.

### Debugging routes

Routes are discovered by enumerating instance properties. If a route doesn't appear:

1. Confirm the property is enumerable (field initializer, not `#` private or getter-only).
2. Confirm the return value has `_isRoute: true` (comes from `this.route()`).
3. Confirm the controller class is registered as a provider in a module imported by the root `HonoModule`.
4. Confirm the controller class has a `_path` static string (set by the `Controller` factory).

### Using the options factory

```typescript
import { HonoModule } from '@ultranomic/di-hono';
import { Module } from '@ultranomic/di';
import { createServer } from 'node:http2';

class HttpModule extends HonoModule({
  options: (resolve) => ({
    middlewares: [cors(), logger()],
    port: 3000,
    host: '0.0.0.0',
    server: { createServer },
  }),
}) {}

class AppModule extends Module({
  imports: [HttpModule],
}) {}
```

The `options` factory receives a `resolve` function (delegates to `container.resolve`) so options can reference registered services. `port` and `host` are required. `server` is optional — pass `{ createServer }` from `node:http2` or `node:https` to enable HTTP/2 or HTTPS.

## Guardrails

- No decorators. No `reflect-metadata`. Controllers and modules use mixin factories with static metadata.
- No `enum` keyword. Use `as const` objects (required by `erasableSyntaxOnly: true`).
- No `interface` keyword. Use `type` aliases.
- No `private` keyword. Use `#` private fields.
- No parameter properties (e.g., `constructor(private x: X)`). Use explicit field declarations.
- No ORPC integration. This package bridges `@ultranomic/di` to Hono only.
- No standalone `getHonoApp` function. Access the Hono instance via a resolved HonoService instance's `.hono` getter.
- No `_routes` static property on controllers. Routes are discovered from instance enumerable properties.
- No standalone `route()` function. Use `this.route()` inside a `Controller` class.
- No `inject()` function. Use constructor injection via the `inject` config on `Controller`.
- No validation library imports in source files. Validation schemas are defined at the usage site (e.g., in controllers). The `types.ts` Standard Schema types define the contract without importing any library.
- No coupling to Zod, Valibot, or any specific validation library. Use the `StandardSchema` type.

## Build Commands

```bash
cd packages/di-hono
vp run build      # Production build
vp test           # Run tests
vp check          # Type check + lint
```

## Dependencies

Runtime dependencies: `@ultranomic/di` (workspace peer), `hono` (peer dependency, ^4.0.0), `@hono/node-server` (^2.0.2).

Dev dependencies: vitest, typescript, zod (test fixtures only). See `package.json` for the full list.

## Related Packages

- `@ultranomic/di` (see `libs/di/AGENTS.md`): Core DI container. Provides `Injectable`, `Module`, `Container`, `Scope` primitives that this package builds on.
