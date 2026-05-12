# @ultranomic/di

Dependency injection framework for Ultranomic. Zero runtime dependencies, no decorators, no reflect-metadata.

## Scope

**In scope:** dependency resolution, lifecycle management, scope enforcement.
**Not in scope:** HTTP routing, middleware, request handling. Those belong in adapter packages like `@ultranomic/di-hono` and `@ultranomic/di-orpc`.

## Conventions

- Always use `extends Injectable(...)` and `extends Module({...})`. Never bypass the mixin factory by manually setting `_scope`, `_inject`, `_providers`, or `_exports`.
- Use `as const` for enum-like objects (required by `erasableSyntaxOnly: true`). No `enum` keyword.
- Use `#` private fields, not `private` keyword.
- Use `type` over `interface`.
- Use `export type` for type-only exports (required by `verbatimModuleSyntax: true`).
- No decorators. No `reflect-metadata`. The DI system uses mixin factories with static metadata.
- No parameter properties (e.g., `constructor(private x: X)`). Use explicit field declarations with `#` private fields.
- No dynamic registration. All providers and modules are declared statically at construction time.
- No proxy-based resolution for non-circular dependencies. Circular dependencies where at least one participant is cached (singleton/request) resolve via transparent Proxy injection at runtime. Transient↔Transient cycles still throw.
- No service locator pattern. Inject dependencies explicitly.
- Constructor injection only. Dependencies arrive as constructor parameters in the order declared in `inject`.
- Lifecycle hooks receive the container as their argument: `onApplicationBootstrap(container)`, `onStart(container)`, `onStop(container)`.
- Test file sits next to source file: `foo.ts` -> `foo.test.ts`.

## Cross-file Changes

### Adding a new scope

1. Add the key-value pair to the `SCOPE` object in `src/scope.ts`.
2. Update `Container.#resolveInternal()` in `src/container.ts` to handle the new scope's caching/instantiation strategy.
3. Update `validateScope()` in `src/graph.ts` if the new scope has constraints on what it can depend on.

### Adding a new log level

1. Add the key-value pair to the `LOG_LEVEL` object in `src/log-level.ts`.
2. Update `LOG_LEVEL_PRIORITY` in `src/logger.ts` to assign a priority number to the new level.
3. Add a corresponding instance method on the Logger class in `src/logger.ts` if the new level needs a dedicated method.

## Testing

```bash
vp test
```

Coverage requirement: 100%. Custom matcher: `toThrowDIError` in `test-utils.ts`. Tests use `vite-plus/test`.

## Related Packages

- `@ultranomic/di-hono` — HTTP routing adapters. Integrates Hono with the DI container for request-scoped service resolution.
- `@ultranomic/di-orpc` — ORPC type-safe RPC adapter. Bridges the DI container with ORPC router composition and middleware wiring.
