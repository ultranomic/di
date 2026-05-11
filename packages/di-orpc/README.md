# @ultranomic/di-orpc

[![Build](https://img.shields.io/badge/build-passing-brightgreen)]() [![Test](https://img.shields.io/badge/test-passing-brightgreen)]() [![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)]()

## TL;DR

ORPC adapter for `@ultranomic/di`. Define RPC procedures as class methods with `OrpcRouter`, compose them via `Module` imports, and extract fully-typed router trees for client-side type inference with `InferOrpcRouterTree`. When used alongside `@ultranomic/di-hono`, ORPC routes auto-mount on the Hono HTTP server.

## Installation

```bash
pnpm add @ultranomic/di-orpc @orpc/server
```

This is a workspace package, so it's already available in the monorepo.

## Quick Start

```typescript
import { Container, Injectable, Module, SCOPE } from '@ultranomic/di';
import { OrpcModule, OrpcRouter, OrpcService } from '@ultranomic/di-orpc';
import { z } from 'zod';

// 1. Define a service
class UserService extends Injectable({ scope: SCOPE.SINGLETON }) {
  async list() {
    return [{ id: '1', name: 'Alice' }];
  }
  async getById(id: string) {
    return { id, name: 'Alice' };
  }
}

// 2. Define an ORPC router with procedures
class UserRouter extends OrpcRouter({
  path: 'user',
  inject: [['userService', UserService]],
}) {
  list = this.orpc.input(z.object({})).handler(async () => {
    return this.inject.userService.list();
  });

  getById = this.orpc.input(z.object({ id: z.string() })).handler(async ({ input }) => {
    return this.inject.userService.getById(input.id);
  });
}

// 3. Compose modules — OrpcModule is standalone infrastructure
class AppModule extends Module({
  imports: [OrpcModule()],
  providers: [UserService, UserRouter],
}) {}

// 4. Start
const container = new Container(AppModule);
await container.start();
const orpcService = container.resolve(OrpcService);
// orpcService.handler is the StandardRPCHandler
```

## Core Concepts

### OrpcRouter

`OrpcRouter` is a mixin factory that extends `Injectable` with ORPC routing metadata. You extend its return value to define a group of procedures under a common path prefix.

**Configuration:**

| Field    | Type                     | Required | Description                             |
| -------- | ------------------------ | -------- | --------------------------------------- |
| `path`   | `string`                 | Yes      | Router path prefix for all procedures.  |
| `inject` | `readonly InjectEntry[]` | No       | Dependencies to inject via constructor. |

Procedures are class field initializers using `this.orpc` (a typed ORPC builder from `os.$context()`). Each procedure is discovered automatically by `OrpcService`.

**Pattern:**

```typescript
class UserRouter extends OrpcRouter({
  path: 'users',
  inject: [['userService', UserService]],
}) {
  list = this.orpc
    .input(z.object({}))
    .output(z.array(z.string()))
    .handler(async () => []);

  create = this.orpc
    .input(z.object({ name: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }))
    .handler(async ({ input }) => ({ id: '1', ...input }));
}
```

Routers are singleton-scoped. Dependencies are declared as named entries and accessed via `this.inject`.

### OrpcMiddleware

`OrpcMiddleware` is a mixin factory for ORPC middleware classes. Use it to create reusable middleware that can `.use()` context enrichment on procedures.

**Pattern:**

```typescript
import { OrpcMiddleware } from '@ultranomic/di-orpc';

class AuthMiddleware extends OrpcMiddleware({}) {
  requireAuth = this.orpc.middleware(async ({ next }) => {
    return next({ context: { userId: 'authenticated-user-id' } });
  });
}
```

### OrpcModule

`OrpcModule` is a standalone infrastructure module that provides and exports `OrpcService`. It does NOT accept `providers`, `exports`, or `imports` — those belong on `Module`. Compose it via the `imports` array on your `Module`.

**Configuration:**

| Field              | Type                               | Required | Description                                       |
| ------------------ | ---------------------------------- | -------- | ------------------------------------------------- |
| `prefix`           | `string`                           | No       | URL prefix for ORPC endpoints (default: `/rpc`).  |
| `plugins`          | `readonly StandardHandlerPlugin[]` | No       | ORPC handler plugins.                             |
| `errorInterceptor` | `ErrorInterceptor`                 | No       | Custom error interceptor for non-ORPC errors.     |
| `options`          | `OrpcModuleOptionsFactory`         | No       | Factory for dynamic options (receives `resolve`). |

**Pattern:**

```typescript
import { OrpcModule } from '@ultranomic/di-orpc';

// Default options (prefix: /rpc)
class AppModule extends Module({
  imports: [OrpcModule()],
  providers: [UserRouter],
}) {}

// Custom prefix
class AppModule extends Module({
  imports: [OrpcModule({ prefix: '/api' })],
  providers: [UserRouter],
}) {}

// Dynamic options with DI resolve
class AppModule extends Module({
  imports: [
    OrpcModule({
      options: (resolve) => ({
        prefix: resolve(ConfigService).orpcPrefix,
      }),
    }),
  ],
  providers: [UserRouter],
}) {}
```

### OrpcService

`OrpcService` is an auto-registered singleton that lazily builds the ORPC router tree. You don't instantiate it directly — `OrpcModule()` adds it to providers for you.

When `.handler` is first accessed, `OrpcService` discovers all `OrpcRouter` providers from `container.sorted`, resolves their instances, collects their procedure properties, and composes the router tree. If a `HonoModule` is found in the module tree, routes auto-mount on the Hono app.

**Accessing the handler:**

```typescript
const container = new Container(AppModule);
await container.start();
const orpcService = container.resolve(OrpcService);
const handler = orpcService.handler; // StandardRPCHandler
```

### Client Type Inference

Use `InferOrpcRouterTree` to extract the typed router tree from your module for client-side type inference:

```typescript
import type { InferOrpcRouterTree } from '@ultranomic/di-orpc';
import type { RouterClient } from '@orpc/client';

class UserModule extends Module({
  providers: [UserRouter],
  exports: [UserRouter],
}) {}

class AppModule extends Module({
  imports: [OrpcModule(), UserModule],
}) {}

type AppRouter = InferOrpcRouterTree<typeof AppModule>;
// => { readonly users: { readonly list: Procedure<...>; readonly getById: Procedure<...> } }

type Client = RouterClient<AppRouter>;
```

### Auto-mount with Hono

When both `OrpcModule()` and `HonoModule` are in the module tree, ORPC routes automatically mount on the Hono app at the configured prefix:

```typescript
import { Controller, HonoModule } from '@ultranomic/di-hono';
import { OrpcModule, OrpcRouter } from '@ultranomic/di-orpc';

class HealthController extends Controller({ path: '/health' }) {
  check = this.route({ method: 'GET', path: '/', handler: (c) => c.json({ status: 'ok' }) });
}

class UserRouter extends OrpcRouter({ path: 'user' }) {
  list = this.orpc.input(z.object({})).handler(async () => []);
}

class AppModule extends Module({
  imports: [HonoModule({ options: () => ({ port: 3000 }) }), OrpcModule()],
  providers: [HealthController, UserRouter],
}) {}

const container = new Container(AppModule);
await container.start();
// REST: GET /health → { status: 'ok' }
// ORPC: POST /rpc/user/list → { json: [...] }
```

### OrpcRequestContext

`OrpcRequestContext` provides access to the current ORPC request context from anywhere in the request scope. It uses `AsyncLocalStorage` under the hood.

```typescript
import { OrpcRequestContext } from '@ultranomic/di-orpc';

class AuditService extends Injectable({ scope: SCOPE.REQUEST }) {
  log(action: string) {
    const ctx = OrpcRequestContext.get();
    // ctx.req — the incoming Request object
  }
}
```

### Error Interceptor

Custom error interceptors catch non-ORPC errors thrown in procedure handlers and transform them into ORPC errors:

```typescript
import { OrpcModule } from '@ultranomic/di-orpc';
import { ORPCError } from '@orpc/server';

class AppModule extends Module({
  imports: [
    OrpcModule({
      errorInterceptor: async (error, context) => {
        if (error instanceof NotFoundError) {
          return new ORPCError('NOT_FOUND', { message: error.message });
        }
        return new ORPCError('INTERNAL', { message: 'Internal error' });
      },
    }),
  ],
  providers: [UserRouter],
}) {}
```

## API Reference

### Exports

| Export                     | Type     | Description                                           |
| -------------------------- | -------- | ----------------------------------------------------- |
| `OrpcRouter`               | Factory  | Creates a router class with typed procedures.         |
| `OrpcMiddleware`           | Factory  | Creates a middleware class with `.orpc` builder.      |
| `OrpcModule`               | Factory  | Standalone module providing `OrpcService`.            |
| `OrpcService`              | Class    | Singleton that builds and exposes the ORPC handler.   |
| `OrpcRequestContext`       | Object   | `AsyncLocalStorage` wrapper for per-request context.  |
| `createErrorInterceptor`   | Function | Creates a DI-aware error interceptor.                 |
| `defaultErrorInterceptor`  | Function | Default interceptor mapping `DIError` to ORPC errors. |
| `InferOrpcRouterTree`      | Type     | Extracts typed router tree from a `ModuleClass`.      |
| `OrpcRouterClass`          | Type     | Type guard for router classes.                        |
| `OrpcMiddlewareClass`      | Type     | Type guard for middleware classes.                    |
| `OrpcModuleClass`          | Type     | Type guard for OrpcModule return classes.             |
| `OrpcModuleConfig`         | Type     | Config shape for `OrpcModule()`.                      |
| `OrpcModuleOptions`        | Type     | Options shape (prefix, plugins, errorInterceptor).    |
| `OrpcModuleOptionsFactory` | Type     | Factory function for async options resolution.        |
| `OrpcRouterConfig`         | Type     | Config shape for `OrpcRouter()`.                      |
| `OrpcMiddlewareConfig`     | Type     | Config shape for `OrpcMiddleware()`.                  |
| `ErrorInterceptor`         | Type     | Error interceptor function signature.                 |

## Build & Test

```bash
cd libs/di-orpc
pnpm build:lib      # Production build (tsgo --noCheck)
pnpm build:dev      # Dev build with declarations and source maps
pnpm typecheck       # Type check without emitting
pnpm test            # Run tests once
pnpm test:dev        # Run tests in watch mode
```

Coverage requirement: 100%. Every source file has a corresponding `.test.ts` file.

## Dependencies

Runtime dependencies: `@ultranomic/di` (workspace).

Peer dependencies: `@orpc/server` ^1.14.0, `@ultranomic/di-hono` (optional, for auto-mount).
