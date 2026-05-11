# DI Examples

Runnable examples for the `@ultranomic/di` dependency injection library.

## Prerequisite

Node.js 25+ with TypeScript support. Examples import directly from `../src/index.ts`.

## Run

```bash
node packages/di/examples/basic-usage.ts
node packages/di/examples/module-imports.ts
node packages/di/examples/module-re-exports.ts
node packages/di/examples/request-scope.ts
node packages/di/examples/transient-scope.ts
node packages/di/examples/lifecycle.ts
```

## Examples

| File                   | What it shows                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `basic-usage.ts`       | `Injectable`, `Module`, `Container`, `resolve` — singleton caching                  |
| `module-imports.ts`    | Multi-module composition with `imports`/`exports`, private providers                |
| `module-re-exports.ts` | `ModuleClass` in `exports`, flattening imported module's `_exports`                 |
| `request-scope.ts`     | `SCOPE.REQUEST`, `withRequestScope()`, per-request isolation                        |
| `transient-scope.ts`   | `SCOPE.TRANSIENT`, fresh instance per `resolve()`, transient depending on singleton |
| `lifecycle.ts`         | `onStart(container)` / `onStop(container)` hooks, dependency ordering               |

## Key Patterns

```typescript
// Define an injectable service
class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

// With dependencies - available via this.inject
class DbService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [['config', ConfigService]],
}) {
  connect() {
    console.log(this.inject.config.getDbUrl()); // ✅ Via inject object
  }
}

// Declare a module
class AppModule extends Module({ providers: [MyService, DbService] }) {}

// Use it
const container = new Container(AppModule);
await container.start();
const service = container.resolve(MyService);
await container.stop();
```
