# @ultranomic/di

[![Build](https://img.shields.io/badge/build-passing-brightgreen)]() [![Test](https://img.shields.io/badge/test-passing-brightgreen)]() [![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)]()

## TL;DR

A minimal, type-safe dependency injection library built on class mixins. Define providers with `Injectable`, compose them with `Module`, and resolve everything through `Container`. No decorators, no reflect-metadata, no framework lock-in.

## Installation

```bash
pnpm add @ultranomic/di
```

This is a workspace package, so it's already available in the monorepo.

## Quick Start

```typescript
import { Injectable, Module, Container } from '@ultranomic/di';

// 1. Define a simple singleton provider
class LoggerService extends Injectable() {
  log(msg: string) {
    console.log(msg);
  }
}

// 2. Define a provider with dependencies
class UserService extends Injectable({
  inject: [['logger', LoggerService]],
}) {
  getUser(id: string) {
    this.inject.logger.log(`Fetching user ${id}`);
    return { id, name: 'Alice' };
  }
}

// 3. Compose in a module
class AppModule extends Module({
  providers: [LoggerService, UserService],
  exports: [UserService],
}) {}

// 4. Create container, start, resolve
const container = new Container(AppModule);
await container.start();
const userService = container.resolve(UserService);
await container.stop();
```

## Core Concepts

### Injectable

`Injectable` is a mixin factory that turns a plain class into a DI-aware provider. You extend its return value to define your service.

**Configuration:**

| Field    | Type                     | Required | Default           | Description                                                               |
| -------- | ------------------------ | -------- | ----------------- | ------------------------------------------------------------------------- |
| `scope`  | `Scope`                  | No       | `SCOPE.SINGLETON` | Lifecycle scope: `SCOPE.SINGLETON`, `SCOPE.TRANSIENT`, or `SCOPE.REQUEST` |
| `inject` | `readonly InjectEntry[]` | No       | `[]`              | Dependencies to inject via constructor (tuple of [name, class])           |

**Pattern:**

```typescript
// With dependencies
class MyService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [
    ['depA', DepA],
    ['depB', DepB],
  ],
}) {
  someMethod() {
    this.inject.depA.doSomething(); // ✅ Via inject object
    this.inject.depB.doOther(); // ✅ Via inject object
  }
}

// Simple singleton with no dependencies
class LoggerService extends Injectable() {
  log(msg: string) {
    console.log(msg);
  }
}
```

Dependencies are resolved in order and passed to the constructor as positional arguments.

#### Lifecycle Hooks

Providers can define optional lifecycle hooks that the container calls during a 3-phase startup (bootstrapping, ready, starting) and a 2-phase shutdown:

**Execution order:**

1. `onApplicationBootstrap(container)` — bootstrapping phase. Providers are being instantiated. `resolve()` is NOT available.
2. `onReady(container)` — ready phase. All singletons are instantiated. `resolve()` IS available. Use for route registration, router binding, etc.
3. `onStart(container)` — starting phase. `resolve()` IS available. Use for starting servers, external connections.
4. `beforeApplicationShutdown(container)` — shutdown phase, called before `onStop`.
5. `onStop(container)` — shutdown phase, called in reverse dependency order.

```typescript
class DatabaseService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [['config', ConfigService]],
}) {
  async onApplicationBootstrap(container: Container): Promise<void> {
    // Bootstrapping: providers are still being instantiated
  }

  async onReady(container: Container): Promise<void> {
    // Ready: resolve() is available. Register routes, bind routers.
  }

  async onStart(container: Container): Promise<void> {
    // Starting: open connections, start servers
    await this.connect(this.inject.config.getConnectionString());
  }
}
```

- Hooks are called for each **singleton** provider in dependency order. Request-scoped providers are started inside `withRequestScope()` instead. Transient providers are skipped — lifecycle hooks are not meaningful for them since each `resolve()` creates a fresh instance.
- `onStop(container)` is called during `container.stop()` in reverse order. Request-scoped providers are stopped at the end of each `withRequestScope()` call.
- If any startup hook throws, already-started providers are stopped (reverse order), and the error propagates. During `start()` rollback, `onStop` errors are intentionally suppressed to avoid masking the original failure.
- If any `onStop` throws, errors are collected and thrown as an `AggregateError`. This applies to `stop()` and the normal `withRequestScope()` cleanup path.

### Logging

The container has a built-in logger accessible via `container.logger`. The default logger outputs messages in the format `[name] YYYY-MM-DD HH:mm:ss LEVEL ...args`.

```typescript
import { Container, DefaultLogger } from '@ultranomic/di';

// Use default logger with custom name
const container = new Container(AppModule, {
  logger: new DefaultLogger({ name: 'MyApp' }),
});

// Access logger from container
container.logger.info('Server started');
```

You can customize the logger by extending the `Logger()` factory:

```typescript
import { Logger } from '@ultranomic/di';

class CustomLogger extends Logger({ name: 'App', level: LOG_LEVEL.INFO }) {
  info(...args: unknown[]) {
    // Custom implementation
  }
}
```

### Module

`Module` is a mixin factory that groups providers and declares what's shared with other modules.

**Configuration:**

| Field       | Type                                 | Required | Description                                                                              |
| ----------- | ------------------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| `providers` | `readonly InjectableClass[]`         | No       | Providers registered in this module (default `[]`)                                       |
| `exports`   | `(InjectableClass \| ModuleClass)[]` | No       | Providers or modules to re-export. Must be from `providers` or `imports` (type-enforced) |
| `imports`   | `readonly ModuleClass[]`             | No       | Modules whose exports become available                                                   |

**Pattern:**

```typescript
class SharedModule extends Module({
  providers: [LoggerService, ConfigService],
  exports: [LoggerService],
}) {}

class FeatureModule extends Module({
  providers: [UserService],
  exports: [UserService],
  imports: [SharedModule],
}) {}

class AppModule extends Module({
  providers: [],
  imports: [FeatureModule],
}) {}
```

Providers listed in `exports` are available to any module that imports this one. Only exported providers are shared. Non-exported providers stay private to the module.

**Module re-exports:**

`exports` accepts both `InjectableClass` and `ModuleClass`. When a `ModuleClass` is listed in `exports`, its providers are flattened recursively. Type-level constraints enforce that exported entries must come from `providers` or `imports`.

```typescript
class DeepModule extends Module({
  providers: [DeepService],
  exports: [DeepService],
}) {}

class MidModule extends Module({
  providers: [MidService],
  imports: [DeepModule],
  exports: [DeepModule, MidService], // Re-export DeepModule + own service
}) {}
// MidModule._exports → [DeepModule, MidService]  (raw; resolveExports flattens DeepModule)
// MidModule._providers → [MidService]  (local providers only)
// MidModule._combinedProviders → [MidService, DeepService]  (local + imported combined exports)
```

**Resolved metadata:**

At definition time, `Module()` resolves:

- `_providers` = own providers only (what was declared in `providers`)
- `_combinedProviders` = `[...ownProviders, ...imports.flatMap(m => m._combinedExports)]` (local + all imported combined exports)
- `_exports` = raw config (preserves `ModuleClass` entries; flattened internally when resolving providers)
- `_combinedExports` = flattened exports (module entries resolved recursively to injectable classes)

### Container

`Container` resolves the full dependency graph, manages lifecycles, and handles scoping.

```typescript
const container = new Container(AppModule);
await container.start();
const service = container.resolve(UserService);
await container.stop();
```

| Method             | Signature                                      | Description                                                                                                                                                                                                                                                            |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolve`          | `<T>(cls: InjectableClass<T>) => T`            | Get an instance. Behavior depends on provider scope.                                                                                                                                                                                                                   |
| `start`            | `() => Promise<void>`                          | 3-phase startup: (1) bootstrapping — instantiate singletons and call `onApplicationBootstrap`, (2) ready — call `onReady`, (3) starting — call `onStart`. Request-scoped providers are started inside `withRequestScope()`.                                            |
| `stop`             | `() => Promise<void>`                          | Call `onStop` hooks in reverse order, mark container as stopped.                                                                                                                                                                                                       |
| `withRequestScope` | `<T>(fn: () => Promise<T> \| T) => Promise<T>` | Run a callback with a fresh request-scoped instance store. All request-scoped providers are instantiated and started before the callback runs. If a request-scoped provider's `onStart` fails, already-started request providers are stopped and the error propagates. |
| `module`           | `ModuleClass`                                  | The root module class passed to the constructor.                                                                                                                                                                                                                       |
| `sorted`           | `readonly InjectableClass[]`                   | Topologically sorted provider list (frozen).                                                                                                                                                                                                                           |

#### Scopes

| Scope             | Behavior                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| `SCOPE.SINGLETON` | One instance per container. Cached after first resolve.                       |
| `SCOPE.TRANSIENT` | New instance on every resolve call.                                           |
| `SCOPE.REQUEST`   | One instance per request scope. Must be resolved inside `withRequestScope()`. |

### Request Scope

Request-scoped providers use Node's `AsyncLocalStorage` under the hood. Each call to `withRequestScope()` creates an isolated store for the duration of the callback.

```typescript
class RequestContext extends Injectable({
  scope: SCOPE.REQUEST,
}) {
  readonly requestId = crypto.randomUUID();
}

// Inside a request handler:
await container.withRequestScope(async () => {
  const ctx = container.resolve(RequestContext);
  // ctx is the same instance throughout this callback
});
```

Attempting to resolve a `SCOPE.REQUEST` provider outside of `withRequestScope()` throws a `DIError` with code `NOT_IN_REQUEST_SCOPE`.

## API Reference

| Export                | Kind     | Description                                                                                                                           |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Injectable`          | Function | Mixin factory. Returns a base class configured with scope and dependencies.                                                           |
| `Module`              | Function | Mixin factory. Returns a base class configured with providers, exports, and imports.                                                  |
| `Container`           | Class    | Entry point for resolving providers and managing lifecycles.                                                                          |
| `SCOPE`               | Object   | `{ SINGLETON, TRANSIENT, REQUEST }` scope constants.                                                                                  |
| `DI_ERROR_CODE`       | Object   | Error code constants for `DIError`.                                                                                                   |
| `DIError`             | Class    | Typed error with a `code: DIErrorCode` discriminator.                                                                                 |
| `Constructor<T>`      | Type     | Generic class constructor: `new (...args: any[]) => T`.                                                                               |
| `InjectableClass`     | Type     | A `Constructor` with `_isInjectable`, `_scope`, `_inject`, and `_injectClasses` static metadata.                                      |
| `InjectableClassBase` | Type     | Minimal `InjectableClass` shape for forward declarations and graph traversal.                                                         |
| `InjectEntry`         | Type     | Tuple of `[name, InjectableClassBase]` for declaring injectable dependencies.                                                         |
| `ModuleClass`         | Type     | A `Constructor` with `_isModule`, `_providers`, `_combinedProviders`, `_combinedExports`, `_exports`, and `_imports` static metadata. |
| `LifecycleHooks<T>`   | Type     | Optional `onApplicationBootstrap`, `onReady`, `onStart`, `beforeApplicationShutdown`, and `onStop` hooks.                             |
| `DIErrorCode`         | Type     | Union of all DI error code literals (derived from `DI_ERROR_CODE`).                                                                   |
| `Scope`               | Type     | Union of valid provider scope literals (derived from `SCOPE`).                                                                        |
| `Logger`              | Function | Factory that creates a logger class with configurable name, level, and inject.                                                        |
| `DefaultLogger`       | Class    | Default logger implementation extending `Logger()`. Name defaults to `'DI'`, level defaults to `DEBUG`.                               |
| `LOG_LEVEL`           | Object   | `{ DEBUG, INFO, WARN, ERROR }` log level constants.                                                                                   |
| `LoggerInstance`      | Type     | Structural type for logger instances: `{ name?, level, inject, debug, info, warn, error }`.                                           |

## Error Handling

Errors thrown during graph construction and state validation are `DIError` instances with a `code` property for programmatic handling. Lifecycle methods may throw other error types: `start()` propagates errors from `onStart` hooks as-is; `stop()` and `withRequestScope()` cleanup failures throw `AggregateError`.

```typescript
import { DI_ERROR_CODE, DIError } from '@ultranomic/di';

await container.start();
try {
  container.resolve(MyService);
} catch (err) {
  if (err instanceof DIError && err.code === DI_ERROR_CODE.MISSING_PROVIDER) {
    // handle missing provider
  }
}
```

| Code                      | When                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `CIRCULAR_DEPENDENCY`     | Provider graph contains a cycle.                                                                                          |
| `MISSING_PROVIDER`        | A dependency is not registered in any reachable module.                                                                   |
| `DUPLICATE_PROVIDER`      | The same provider appears in multiple modules.                                                                            |
| `EXPORT_NOT_IN_PROVIDERS` | A class listed in `exports` is not in `providers`.                                                                        |
| `EXPORT_NOT_IN_IMPORTS`   | A module listed in `exports` is not in `imports`.                                                                         |
| `SCOPE_VIOLATION`         | A Singleton provider directly or transitively depends on a Request-scoped provider.                                       |
| `NOT_IN_REQUEST_SCOPE`    | Resolving a Request-scoped provider, or a provider that depends on one, outside `withRequestScope()`.                     |
| `CONTAINER_STOPPED`       | Calling `resolve()`, `start()`, or `withRequestScope()` after `container.stop()`.                                         |
| `CONTAINER_NOT_STARTED`   | Calling `resolve()`, `stop()`, or `withRequestScope()` before `container.start()` completes, or after a failed `start()`. |
| `ALREADY_STARTED`         | Calling `start()` on a container that has already been started or is starting.                                            |
| `UNKNOWN_SCOPE`           | Provider has an unrecognized scope value. Internal error.                                                                 |
| `DUPLICATE_INJECT_KEY`    | Duplicate inject key in `Injectable` config (type-level check).                                                           |

## Examples

See the `examples/` directory for complete usage patterns.

## License

Private. All rights reserved.
