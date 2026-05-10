# @ultranomic/di-hono

[![Build](https://img.shields.io/badge/build-passing-brightgreen)]() [![Test](https://img.shields.io/badge/test-passing-brightgreen)]() [![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)]()

## TL;DR

Hono adapter for `@ultranomic/di`. Define route handlers as class methods with `Controller`, declare validation with the Standard Schema interface, and wire everything together with `HonoModule`. Each request runs inside a container request scope with the Hono `Context` available via `RequestContext`.

## Installation

```bash
pnpm add @ultranomic/di-hono hono
```

This is a workspace package, so it's already available in the monorepo.

## Quick Start

```typescript
import { Container, Injectable, Module, SCOPE } from "@ultranomic/di";
import { Controller, HonoModule } from "@ultranomic/di-hono";
import { z } from "zod";

// 1. Define a service
class UserService extends Injectable({ scope: SCOPE.SINGLETON }) {
  async create(data: { name: string }) {
    return { id: "1", ...data };
  }
  async list() {
    return [];
  }
}

// 2. Define a controller with route fields
class UserController extends Controller({
  path: "/users",
  inject: [["userService", UserService]],
}) {
  create = this.route({
    method: "POST",
    path: "/",
    validate: { json: z.object({ name: z.string() }) },
    handler: async (c) => {
      const body = c.req.valid("json");
      const user = await this.inject.userService.create(body);
      return c.json(user, 201);
    },
  });

  list = this.route({
    method: "GET",
    path: "/",
    handler: async (c) => {
      return c.json(await this.inject.userService.list());
    },
  });
}

// 3. Compose modules
class UserModule extends Module({
  providers: [UserService, UserController],
  exports: [UserController],
}) {}

class HttpModule extends HonoModule({
  options: () => ({
    port: 3000,
    host: "0.0.0.0",
  }),
}) {}

class AppModule extends Module({
  imports: [HttpModule, UserModule],
}) {}

// 4. Start
const container = new Container(AppModule);
await container.start();
```

## Core Concepts

### Controller

`Controller` is a mixin factory that extends `Injectable` with routing metadata. You extend its return value to define a group of routes under a common path prefix.

**Configuration:**

| Field    | Type                     | Required | Description                                   |
| -------- | ------------------------ | -------- | --------------------------------------------- |
| `path`   | `string`                 | Yes      | URL prefix for all routes in this controller. |
| `inject` | `readonly InjectEntry[]` | No       | Dependencies to inject via `this.inject`.     |

Controllers are singleton-scoped by default. Dependencies are declared as named entries and accessed via `this.inject`.

**Pattern:**

```typescript
class UserController extends Controller({
  path: "/users",
  inject: [["userService", UserService]],
}) {
  // Dependencies available via this.inject
}
```

### route()

`route()` is a public method on the `Controller` base class. Call it in a class field initializer to define an HTTP endpoint. Each call returns a `RouteDefinition` that `HonoService` discovers and registers automatically.

**Parameters:**

| Field      | Type                                            | Required | Description                                                                 |
| ---------- | ----------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `method`   | `HttpMethod`                                    | Yes      | HTTP method: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, or `OPTIONS`. |
| `path`     | `string`                                        | Yes      | Route path, relative to the controller's `path` prefix.                     |
| `validate` | `ValidateTargets`                               | No       | Per-target validation schemas.                                              |
| `handler`  | `(c: Context) => Promise<Response> \| Response` | Yes      | Hono context handler. Receives the standard Hono `Context` object.          |

**Pattern:**

```typescript
create = this.route({
  method: "POST",
  path: "/",
  handler: async (c) => {
    return c.json({ ok: true }, 201);
  },
});
```

Every handler automatically runs inside a container request scope with `RequestContext` set. You don't need to wrap handlers yourself.

### Validation

Validation uses the Standard Schema interface, not a specific library. Any library that implements the `~standard` property works natively: Zod v4, Valibot, ArkType, or a custom implementation. Pass schemas directly to `validate` — no adapter needed for Standard Schema-compliant libraries.

**ValidateTargets:**

| Target   | Validates                 |
| -------- | ------------------------- |
| `json`   | Parsed JSON request body. |
| `query`  | Query string parameters.  |
| `param`  | URL path parameters.      |
| `header` | Request headers.          |
| `form`   | Form data.                |
| `cookie` | Cookie values.            |

Validation runs before the handler. If validation fails, the response is `400` with `{ error: 'Validation failed', issues: [...] }`.

**Pattern with Zod v4 (native Standard Schema support):**

```typescript
import { z } from "zod";

create = this.route({
  method: "POST",
  path: "/",
  validate: {
    json: z.object({ name: z.string(), email: z.string().email() }),
    query: z.object({ notify: z.enum(["true", "false"]).optional() }),
  },
  handler: async (c) => {
    // c.req.valid('json') returns the validated data
    const body = c.req.valid("json");
    return c.json(body, 201);
  },
});
```

**Pattern with a non-compliant library (custom adapter):**

If your validation library does not implement `~standard` natively, wrap it in a `StandardSchema` object:

```typescript
import type { StandardSchema, StandardResult } from "@ultranomic/di-hono";

function toStandard<T>(
  validate: (value: unknown) => { data: T } | { errors: string[] },
): StandardSchema<T> {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "custom" as const,
      validate(value: unknown): StandardResult<T> {
        const result = validate(value);
        return "data" in result
          ? { value: result.data }
          : { issues: result.errors.map((message) => ({ message })) };
      },
    },
  };
}
```

### HonoModule

`HonoModule` is a mixin factory that extends `Module` with Hono-specific configuration. It automatically adds `HonoService` to both providers and exports if you don't include it yourself.

**Configuration:**

| Field       | Type                         | Required | Description                                                           |
| ----------- | ---------------------------- | -------- | --------------------------------------------------------------------- |
| `providers` | `readonly InjectableClass[]` | No       | Services and controllers to register (default `[]`).                  |
| `exports`   | `readonly InjectableClass[]` | No       | Providers visible to importing modules (`HonoService` auto-exported). |
| `imports`   | `readonly ModuleClass[]`     | No       | Modules whose exports become available.                               |
| `options`   | `HonoModuleOptionsFactory`   | No       | Factory for server configuration.                                     |

```typescript
import { HonoModule } from "@ultranomic/di-hono";

class HttpModule extends HonoModule({
  options: () => ({
    port: 3000,
    host: "0.0.0.0",
  }),
}) {}

class AppModule extends Module({
  imports: [HttpModule],
}) {}
```

The `options` factory receives a `resolve` function so you can read configuration from DI providers:

```typescript
class HttpModule extends HonoModule({
  options: (resolve) => ({
    middlewares: [cors(), logger()],
    port: resolve(ConfigService).port,
    host: resolve(ConfigService).host,
  }),
}) {}
```

### HonoService

`HonoService` is an auto-registered singleton that creates and configures the Hono app. You don't instantiate it directly. `HonoModule` adds it to providers for you.

When `.hono` is first accessed, `HonoService` discovers all controller providers, resolves their instances, collects their route definitions, and registers them on the Hono app. Each handler is wrapped to run inside a container request scope with `RequestContext` set.

**Accessing the Hono instance:**

```typescript
const container = new Container(AppModule);
await container.start();
const honoService = container.resolve(HonoService);
const app = honoService.hono;
```

| Property  | Type   | Description                                                                                                                                                    |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hono`    | Getter | The configured Hono application instance.                                                                                                                      |
| `port`    | Getter | `number \| undefined` — Configured server port from module options.                                                                                            |
| `host`    | Getter | `string \| undefined` — Configured server host from module options.                                                                                            |
| `onStart` | Method | Lifecycle hook called by the container. Sets container reference. Route registration (including error handler binding) happens lazily on first `.hono` access. |
| `onStop`  | Method | Lifecycle hook called by the container. Resets internal state (HonoService does not manage a server lifecycle).                                                |

### RequestContext

`RequestContext` provides access to the current Hono `Context` from anywhere in the request scope. It uses `AsyncLocalStorage` under the hood.

```typescript
import { RequestContext } from "@ultranomic/di-hono";

class AuditService extends Injectable({
  scope: SCOPE.REQUEST,
}) {
  log(action: string) {
    const c = RequestContext.get();
    const requestId = c?.req.header("x-request-id") ?? "unknown";
    console.log(`[${requestId}] ${action}`);
  }
}
```

| Method | Signature                                             | Description                                                                     |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `get`  | `() => Context \| undefined`                          | Returns the current Hono `Context`, or `undefined` if called outside a request. |
| `run`  | `<T>(c: Context, fn: () => Promise<T>) => Promise<T>` | Runs a callback with the given context set. Called internally by HonoService.   |

### Options Factory

The `options` field on `HonoModule` accepts a factory function that receives a `resolve` callback. Use it to configure global middleware from DI providers.

**HonoModuleOptions:**

| Field          | Type                           | Description                        |
| -------------- | ------------------------------ | ---------------------------------- |
| `middlewares?` | `readonly MiddlewareHandler[]` | Global Hono middleware to apply.   |
| `port?`        | `number`                       | Server port number (e.g., `3000`). |
| `host?`        | `string`                       | Server host (e.g., `'0.0.0.0'`).   |

### Scopes

Controllers are always singletons. But route handlers run inside `container.withRequestScope()`, so any `SCOPE.REQUEST` providers resolved during a request get a fresh instance per request. This means your services can use `SCOPE.REQUEST` to hold per-request state (like audit trails, request IDs, or user context) without passing arguments through every function call.

## API Reference

| Export                     | Kind     | Description                                                                                                                                                                                              |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Controller`               | Function | Mixin factory. Returns a base class extending `Injectable` with a `path` prefix and `route()` method.                                                                                                    |
| `HonoModule`               | Function | Mixin factory. Returns a base class extending `Module` with Hono server configuration.                                                                                                                   |
| `HonoService`              | Class    | Auto-registered singleton that creates and configures the Hono app.                                                                                                                                      |
| `RequestContext`           | Object   | `AsyncLocalStorage` wrapper providing access to the Hono `Context` during requests.                                                                                                                      |
| `errorHandler`             | Function | Default Hono error handler. Maps `DIError` to `500` and `HTTPException` to its response.                                                                                                                 |
| `ControllerConfig`         | Type     | Configuration for `Controller`: `{ path, inject? }`.                                                                                                                                                     |
| `ControllerClass`          | Type     | Type marker for controller classes: `InjectableClass & { _path: string }`.                                                                                                                               |
| `HttpMethod`               | Type     | HTTP method literal: `'GET' \| 'POST' \| 'PUT' \| 'DELETE' \| 'PATCH' \| 'HEAD' \| 'OPTIONS'`.                                                                                                           |
| `RouteDefinition`          | Type     | Internal route descriptor: `{ _isRoute, method, path, validate?, handler }`.                                                                                                                             |
| `StandardSchema`           | Type     | Generic validation schema interface with Input/Output generics: `{ '~standard': { version: 1, vendor, validate(value, options?): StandardResult<Output> \| Promise<StandardResult<Output>>, types? } }`. |
| `StandardIssue`            | Type     | Validation issue: `{ message, path? }`.                                                                                                                                                                  |
| `StandardResult`           | Type     | Validation result: `{ value: T, issues?: undefined } \| { issues: readonly StandardIssue[] }`.                                                                                                           |
| `ValidateTargets`          | Type     | Per-target validation schemas: `{ json?, query?, param?, header?, form?, cookie? }`.                                                                                                                     |
| `HonoModuleOptions`        | Type     | Server configuration: `{ middlewares?, port?, host? }`.                                                                                                                                                  |
| `HonoModuleOptionsFactory` | Type     | Factory function: `(resolve) => HonoModuleOptions`.                                                                                                                                                      |
| `HonoModuleConfig`         | Type     | Configuration object for HonoModule — providers, exports, imports, options.                                                                                                                              |
| `HonoModuleClass`          | Type     | Type marker for classes created by `HonoModule()`.                                                                                                                                                       |
| `StandardPathSegment`      | Type     | Structured path segment in `StandardIssue.path` (e.g., `{ key: 'name' }`).                                                                                                                               |

## Error Handling

The default `errorHandler` is registered on the Hono app during startup. It handles two error types:

- **DIError**: Returns `500` with `{ error: { code, message } }`. Covers all `@ultranomic/di` error codes.
- **HTTPException**: Delegates to Hono's built-in response (respects status code and body).

Unhandled errors are re-thrown to Hono's default handling.

**DIError to HTTP status mapping:**

| DIError Code              | HTTP Status | When                                                                  |
| ------------------------- | ----------- | --------------------------------------------------------------------- |
| `CIRCULAR_DEPENDENCY`     | 500         | Provider graph contains a cycle.                                      |
| `MISSING_PROVIDER`        | 500         | A dependency is not registered in any reachable module.               |
| `DUPLICATE_PROVIDER`      | 500         | The same provider appears in multiple modules.                        |
| `EXPORT_NOT_IN_PROVIDERS` | 500         | A class listed in `exports` is not in `providers`.                    |
| `SCOPE_VIOLATION`         | 500         | A Singleton provider depends on a Request-scoped provider.            |
| `NOT_IN_REQUEST_SCOPE`    | 500         | Resolving a Request-scoped provider outside `withRequestScope()`.     |
| `CONTAINER_STOPPED`       | 500         | Calling `resolve()` after `container.stop()`.                         |
| `CONTAINER_NOT_STARTED`   | 500         | Calling `resolve()` before `container.start()`.                       |
| `ALREADY_STARTED`         | 500         | Calling `start()` on an already-started container.                    |
| `UNKNOWN_SCOPE`           | 500         | Provider has an unrecognized scope value.                             |
| `DUPLICATE_INJECT_KEY`    | 500         | The same inject key appears more than once in an `Injectable` config. |

All `DIError` codes map to `500` because they indicate infrastructure or configuration problems, not client errors. Validation errors return `400` separately through the validation middleware.

## Examples

See the `examples/` directory for complete usage patterns.

## License

Private. All rights reserved.
