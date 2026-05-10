# @ultranomic/di

Dependency injection framework for GTN. Zero runtime dependencies, no decorators, no reflect-metadata.

## Package Overview

`@ultranomic/di` is a minimal DI container built on mixin factories and static metadata. Services self-declare their scope and dependencies by extending `Injectable({...})`. Modules wire providers and exports by extending `Module({...})`. The container resolves instances, detects cycles, validates scopes, and manages lifecycle hooks.

Scope: dependency resolution, lifecycle management, scope enforcement.
Not in scope: HTTP routing, middleware, request handling. Those belong in adapter packages like `@ultranomic/di-hono`.

## Architecture

| File                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/scope.ts`      | `SCOPE` const object (`SINGLETON`, `TRANSIENT`, `REQUEST`) using `as const`. No enum. Type alias `Scope` derived from const.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/types.ts`      | Public type definitions: `Constructor`, `InjectableClassBase`, `InjectEntry`, `InjectableClass`, `ModuleClass`, `LifecycleHooks`.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/di-error.ts`   | `DIError` class with `DIErrorCode` type discriminator and `DI_ERROR_CODE` const object (frozen). Eleven error codes covering cycles, missing/duplicate providers, invalid exports, scope violations, request scope, unknown scope, stopped/not-started container, already-started container, and duplicate inject keys.                                                                                                                                                                                                                                                            |
| `src/injectable.ts` | `Injectable()` mixin factory. Returns a base class with `_scope` and `_inject` static metadata. Services extend this to declare scope and dependencies. Config is optional — defaults to singleton scope with no dependencies.                                                                                                                                                                                                                                                                                                                                                     |
| `src/module.ts`     | `Module()` mixin factory. Returns a base class with `_isModule`, `_providers`, `_exports`, `_imports` static metadata. `exports` accepts both `InjectableClass` (from `providers`) and `ModuleClass` (from `imports`) for re-exporting. `_providers` and `_exports` are resolved at definition time: `_providers` includes imported modules' resolved exports, `_exports` preserves raw config entries (may contain `ModuleClass` refs; flattened internally when resolving providers). Type-level constraints enforce exports only contain entries from `providers` or `imports`. |
| `src/graph.ts`      | Internal dependency graph builder. Collects providers from module tree, validates no duplicates, builds adjacency list, runs topological sort with cycle detection, validates scope rules (singleton cannot depend on request-scoped). Used internally by `Container`.                                                                                                                                                                                                                                                                                                             |
| `src/container.ts`  | `Container` class. Constructor takes a `ModuleClass` and builds the graph. `resolve()` creates instances based on scope (singleton cache, transient fresh, request via AsyncLocalStorage). `start()`/`stop()` call lifecycle hooks for singleton providers only (request-scoped are started inside `withRequestScope()`, transients are skipped). `withRequestScope()` runs a callback with a per-request instance store.                                                                                                                                                          |
| `src/index.ts`      | Barrel exports.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Data flow: `Module()` resolves providers and exports at construction time — `_providers` merges imported modules' resolved exports with own providers, `_exports` preserves raw config (may contain `ModuleClass` entries; flattened internally when resolving providers). `Container` constructor calls `buildGraph()` which collects providers from the module tree (using a Set to deduplicate), detects cycles, validates scopes, and produces a topologically sorted list. `start()` instantiates singleton providers in sorted order, calling `onStart` hooks. `resolve()` resolves a specific class via recursive dependency resolution using the provider set from the graph, creating instances with deps injected as constructor args. `stop()` calls `onStop` hooks in reverse sorted order.

## Conventions

- Always use `extends Injectable(...)` and `extends Module({...})`. Never bypass the mixin factory by manually setting `_scope`, `_inject`, `_providers`, or `_exports`. Config is optional for `Injectable()` — defaults to singleton scope with no dependencies.
- Use `as const` for enum-like objects (required by `erasableSyntaxOnly: true`). No `enum` keyword.
- Use `#` private fields, not `private` keyword.
- Use `type` over `interface`.
- Lifecycle hooks receive the container as their argument: `onStart(container)`, `onStop(container)`.
- Use `export type` for type-only exports (required by `verbatimModuleSyntax: true`).
- Constructor injection only. Dependencies arrive as constructor parameters in the order declared in `inject`.
- Test file sits next to source file: `foo.ts` -> `foo.test.ts`.

## Testing

Run tests:

```bash
cd libs/di
pnpm test
```

Coverage requirement: 100%. Every source file has a corresponding `.test.ts` file in the same directory.

Test files:

- `scope.test.ts`
- `types.test.ts`
- `di-error.test.ts`
- `injectable.test.ts`
- `module.test.ts`
- `graph.test.ts`
- `container.test.ts`
- `injectable.test-d.ts`
- `module.test-d.ts`
- `container.test-d.ts`

Test utilities:

- `test-utils.ts` (custom `toThrowDIError` matcher)

Tests use vitest. Write tests first (TDD).

## Common Tasks

### Adding a new Injectable service

```typescript
import { Injectable } from "@ultranomic/di";
import { SCOPE } from "@ultranomic/di";

// With dependencies
export class UserService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [
    ["db", DbService],
    ["logger", LoggerService],
  ],
}) {
  async getUser(id: string) {
    this.inject.logger.log(`Fetching user ${id}`);
    return this.inject.db.query.users.findFirst({ where: { id } });
  }
}

// Simple singleton with no dependencies
export class ConfigService extends Injectable() {
  readonly #env = process.env;

  get(key: string) {
    return this.#env[key];
  }
}
```

Key points:

- Config is optional. `Injectable()` defaults to singleton scope with no dependencies.
- `inject` is an array of `[name, Class]` tuples. Names become properties on `this.inject`.
- Dependencies are available via `this.inject` — no manual constructor needed.
- Access dependencies via `this.inject.propertyName`.

### Adding a new Module

```typescript
import { Module } from "@ultranomic/di";
import type { InjectableClass } from "@ultranomic/di";

export class UserModule extends Module({
  providers: [UserService, UserRepository],
  exports: [UserService],
  imports: [DatabaseModule],
}) {}
```

`exports` controls what other modules can see when they import this one. `imports` pulls in other modules' exports. `exports` accepts both `InjectableClass` (must be in `providers`) and `ModuleClass` (must be in `imports`) — module entries are preserved in `_exports` and flattened internally when resolving providers. Type-level constraints enforce that exports can only reference entries from `providers` or `imports`.

**Resolved metadata at definition time:**

- `_providers` = `[...imports.flatMap(m => resolveExports(m._exports)), ...ownProviders]`
- `_exports` = raw config (preserves `ModuleClass` entries); flattened internally when resolving providers

**Module re-export example:**

```typescript
class DeepModule extends Module({
  providers: [DeepService],
  exports: [DeepService],
}) {}

class MidModule extends Module({
  providers: [MidService],
  imports: [DeepModule],
  exports: [DeepModule, MidService], // Re-export DeepModule + own
}) {}
// MidModule._exports → [DeepModule, MidService]  (raw; resolveExports flattens DeepModule)
// MidModule._providers → [DeepService, MidService]
```

### Adding a new scope

Scopes are defined in `scope.ts` as a const object. To add a new scope:

1. Add the key-value pair to the `SCOPE` object in `src/scope.ts`.
2. Update `Container.#resolveInternal()` in `src/container.ts` to handle the new scope's caching/instantiation strategy.
3. Update `validateScope()` in `src/graph.ts` if the new scope has constraints on what it can depend on.

### Debugging DI resolution

Common error codes and their meanings:

| Code                      | Meaning                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CIRCULAR_DEPENDENCY`     | Two or more providers depend on each other. Check the error message for the cycle path.                                                        |
| `MISSING_PROVIDER`        | A dependency is listed in `inject` but no module provides it. Either add it to a module's `providers` or import the module that exports it.    |
| `DUPLICATE_PROVIDER`      | Same provider class registered in multiple modules. Remove it from one.                                                                        |
| `EXPORT_NOT_IN_PROVIDERS` | A class listed in `exports` is not in `providers`. Exports must be a subset of providers.                                                      |
| `SCOPE_VIOLATION`         | A singleton depends on a request-scoped provider. Singleton instances outlive request scopes, so the dependency would be stale or missing.     |
| `NOT_IN_REQUEST_SCOPE`    | `resolve()` called for a request-scoped provider outside `withRequestScope()`. Wrap the call in `container.withRequestScope(async () => ...)`. |
| `CONTAINER_STOPPED`       | `resolve()` called after `container.stop()`.                                                                                                   |
| `CONTAINER_NOT_STARTED`   | `resolve()` called before `container.start()`. Call `start()` first.                                                                           |
| `ALREADY_STARTED`         | `start()` called on a container that has already been started or is starting.                                                                  |
| `UNKNOWN_SCOPE`           | Provider has an unrecognized scope value. Internal error — indicates a bug or manual scope override.                                           |
| `DUPLICATE_INJECT_KEY`    | The same inject key appears more than once in an `Injectable` config. Rename one of the duplicate entries.                                     |

## Guardrails

- No decorators. No `reflect-metadata`. The DI system uses mixin factories with static metadata.
- No `enum` keyword. Use `as const` objects (required by `erasableSyntaxOnly: true`).
- No parameter properties (e.g., `constructor(private x: X)`). Use explicit field declarations with `#` private fields.
- No HTTP, routing, or middleware abstractions. Those belong in adapter packages like `@ultranomic/di-hono`.
- No dynamic registration. All providers and modules are declared statically at construction time.
- No proxy-based resolution for non-circular dependencies. Circular dependencies where at least one participant is cached (singleton/request) resolve via transparent Proxy injection at runtime. Transient↔Transient cycles still throw.
- No service locator pattern. Inject dependencies explicitly.

## Dependencies

Runtime dependencies: none.

Dev dependencies: vitest, typescript, @vitest/coverage-v8, @ultranomic/tsconfig, @types/node, @typescript/native-preview. See `package.json` for the full list.

## Related Packages

- `@ultranomic/di-hono` (see `.sisyphus/plans/gtn-di-hono.md`): Builds HTTP routing adapters on top of the `Module()` primitive. Integrates Hono with the DI container for request-scoped service resolution.
