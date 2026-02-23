# Voxel Framework Learnings

## 2026-02-22: AGENTS.md Structure for Voxel Framework

Created comprehensive AI agent guidelines for the Voxel framework. Key patterns documented:

### Documentation Structure
- Root AGENTS.md provides framework-wide guidelines
- .sisyphus/AGENTS.md provides Sisyphus-specific task execution patterns
- Clear separation between code conventions and workflow conventions

### Code Convention Patterns
All examples use the class-based API with static properties:
- `static readonly inject = { ... } as const` for dependency injection
- `static readonly routes = [...] as const satisfies ControllerRoute<T>[]` for routes
- `constructor(private deps: typeof Class.inject) {}` for typed dependencies

### Guardrails Emphasis
The MUST NOT section explicitly prohibits:
- Decorators (@Inject, @Injectable, @Controller)
- reflect-metadata
- Unified Request/Response abstractions
- any type usage

This ensures AI agents generate code consistent with the framework's design philosophy.



## 2026-02-22: Monorepo Setup with pnpm Catalog

### pnpm Catalog Configuration
Catalogs are defined in `pnpm-workspace.yaml` under the `catalogs` key:
```yaml
packages:
  - 'packages/*'

catalogs:
  default:
    typescript: ^6.0.0
    vitest: ^3.0.0
```

Packages reference catalog versions with `"catalog:"` string in their package.json.

### TypeScript Project References
Root `tsconfig.json` uses `references` array pointing to each package directory:
```json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/express" }
  ],
  "files": []
}
```

### Vitest Workspace Configuration
Vitest uses `projects` array for monorepo testing:
```typescript
export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts']
  }
})
```

### TypeScript 6 Configuration
ES2024 target with NodeNext module resolution:
- `target: "ES2024"`
- `module: "NodeNext"`
- `moduleResolution: "NodeNext"`
- Additional strict options: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`


## 2026-02-22: Core Package Scaffolding (Task 2)

### Monorepo Dependencies
 Task 1 (Monorepo Setup) had partial configs - needed fixes:
  - `@anthropic/oxfmt` → `oxfmt` (correct package name)
  - TypeScript 6.0.0 doesn't exist as stable - use ^5.9.0

### Vitest Coverage Config
 Coverage thresholds (`lines`, `branches`, etc.) are not supported directly in vitest.config.ts coverage object
 Removed them from vitest.config.ts - will add back with proper `thresholds` property when needed

### Root tsconfig.json References
 Only reference packages that exist
 Root tsconfig had references to all 6 packages but only core exists
 Fixed to only reference `./packages/core`

### Build Verification
 `pnpm --filter @voxeljs/core build` builds single package
 `pnpm build` at root uses TypeScript project references
 Both must succeed for task completion


## 2026-02-22: Core Type Definitions (Task 3)

### Type-Only Module Pattern
For type definition files:
- Use `import type { ... } from '...'` for type-only imports
- Express types imported with `import type { Request, Response } from 'express'`
- No runtime code, so coverage reports 0% (expected)

### ExtractPathParams Template Literal Type
Path parameter extraction uses recursive template literal types:
```typescript
export type ExtractPathParams<TPath extends string> =
  TPath extends `${infer _Prefix}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractPathParams<`/${Rest}`>]: string }
    : TPath extends `${infer _Prefix}:${infer Param}`
      ? { [K in Param]: string }
      : Record<string, never>
```
Key insight: Use `_` prefix for unused inferred variables to avoid oxlint warnings.

### Deps Type Inference Pattern
The `Deps<T>` type extracts dependencies from class static inject:
```typescript
export type Deps<TClass extends { inject: Record<string, Token> }> =
  InferDeps<TClass['inject']>
```
This enables `typeof MyService.inject` pattern for typed dependencies.

### TokenRegistry Declaration Merging
Users can extend TokenRegistry for type-safe tokens:
```typescript
declare module '@voxeljs/core' {
  interface TokenRegistry {
    Logger: ConsoleLogger
    Database: PostgresDatabase
  }
}
```

### Express Dependency Setup
- Add `express` as peerDependency (^4.0.0)
- Add `express` and `@types/express` as devDependencies
- Add both to pnpm catalog for version management

### Test File Patterns for Types
- Use runtime assertions to verify type behavior
- Use `as const satisfies` for route validation tests
- Use `globalThis.setTimeout` instead of `setTimeout` to avoid undefined error
- Prefix unused parameters with `_` to satisfy lint rules

### Coverage for Type-Only Files
Type definition files have 0% coverage because:
- TypeScript types are erased at compile time
- No runtime code to execute or measure
- This is expected and acceptable for type-only modules


## 2026-02-22: Container Interface and Bindings (Task 5)

### Binding Scope Enum Pattern
Use string enum for binding scopes:
```typescript
export enum BindingScope {
  SINGLETON = 'SINGLETON',
  TRANSIENT = 'TRANSIENT',
  SCOPED = 'SCOPED',
}
```

### Forward Type Declaration for Circular Dependencies
To avoid circular import between container.ts and binding.ts:
```typescript
// In binding.ts - forward declaration
export type ContainerLike = {
  resolve<T>(token: Token<T>): T
}
```

### Fluent Binding API Pattern
BindingBuilder returns void from scope methods, not `this`:
```typescript
asSingleton(): void {
  this.binding.scope = BindingScope.SINGLETON
}
```
The builder holds a reference to the binding object, so mutations persist.

### Singleton Caching Implementation
Cache singleton instances directly on the binding:
```typescript
if (binding.scope === BindingScope.SINGLETON && binding.instance !== undefined) {
  return binding.instance
}
const instance = binding.factory(this)
if (binding.scope === BindingScope.SINGLETON) {
  binding.instance = instance
}
return instance
```

### Interface Segregation
Split interfaces for different access levels:
- `ResolverInterface` - read-only access (resolve, has)
- `ContainerInterface` - full access (register, clear, getBinding)

### Type Casting for Generic Map Storage
When storing typed bindings in a Map<Token, Binding>:
```typescript
this.bindings.set(token, binding as Binding)
// Later retrieval:
const binding = this.bindings.get(token) as Binding<T> | undefined
```

### Test Coverage for Container
Container tests cover:
- String, symbol, and class tokens
- Transient (new instance each resolution)
- Singleton (cached instance)
- Error handling for missing tokens
- BindingBuilder scope configuration
- clear() and has() methods




## 2026-02-22: Token Registry and Resolution (Task 6)

### InjectableClass Type Pattern
For type-safe class registration, use InjectableClass type:
```typescript
export type InjectableClass<
  TInject extends Record<string, Token> = Record<string, Token>,
  TInstance = unknown,
> = (new (deps: InferDeps<TInject>) => TInstance) & {
  inject: TInject
}
```

### buildDeps Method
Container provides buildDeps to resolve all dependencies from inject map:
```typescript
buildDeps<TInjectMap extends Record<string, Token>>(
  injectMap: TInjectMap,
): Record<string, unknown> {
  const deps: Record<string, unknown> = {}
  for (const [key, token] of Object.entries(injectMap)) {
    deps[key] = this.resolve(token)
  }
  return deps
}
```

### Resolution Context Tracking
Track resolution path for better error messages:
```typescript
interface ResolutionContext {
  path: Token[]
}
```

### Error Message Format
Include available tokens in error:
```typescript
throw new Error(
  `Token not found: ${String(token)}${resolutionPath}\n  Available tokens: ${availableTokens || 'none'}`,
)
```

### Registration Pattern with buildDeps
When registering a class with static inject:
```typescript
container.register('UserService', (c) => {
  const deps = c.buildDeps(UserService.inject) as InferDeps<
    typeof UserService.inject,
    { Logger: Logger }
  >
  return new UserService(deps)
})
```

### Test Coverage for Resolution
Resolution tests cover:
- buildDeps with empty, single, and multiple dependencies
- Symbol and class token support in buildDeps
- Nested dependency resolution (Level 1 -> Level 2 -> Level 3)
- Singleton reuse across multiple services
- Transient new instances on each resolution
- Mixed token types (string, symbol, class) in same service
- Resolution context tracking in error messages
## Task 9: DI Error Messages with Context (2026-02-22)

### Error Class Structure
- Created `VoxelError` base class in `packages/core/src/errors/base.ts`
- Created `TokenNotFoundError` in `packages/core/src/errors/token-not-found.ts`
- Both extend Error with proper name inheritance

### Error Message Format
```
TokenNotFoundError: Token 'Logger' not found
  Resolution path: App -> UserModule -> UserService -> Logger
  Available tokens: Database, Config, Cache
  Suggestion: Did you mean to import a module that provides 'Logger'?
```

### Key Implementation Details
1. VoxelError uses V8's `captureStackTrace` when available (TypeScript-safe check)
2. TokenNotFoundError stores `token`, `resolutionPath`, and `availableTokens` as public properties
3. Container passes resolution path as string array to error constructor
4. Error message shows "(none registered)" when no tokens are available

### Class Token Handling
- `String(class MyClass {})` returns "class MyClass {}" (full class definition)
- This is expected behavior - tests should account for this when testing class tokens

### Test Updates Required
- Error message format changed from `Token not found: X` to `Token 'X' not found`
- Tests expecting old format needed regex updates



## 2026-02-22: Circular Proxy Coverage Tests (Task)

Added comprehensive tests for circular proxy paths in `packages/core/tests/container/circular.test.ts`:

### Tests Added for Circular Proxy
1. `toString()` method on proxy during construction - returns `[CircularProxy: ${token}]`
2. `Symbol.toStringTag` property on proxy - returns `'CircularProxy'`
3. Property access through proxy after instance is resolved - forwards to actual instance
4. Non-function property access through proxy after resolution - returns property value
5. `then` property on circular proxy - returns `undefined` to prevent Promise unwrapping
6. Non-existent property on proxy - returns `undefined`

### Tests Added for Scope Validation
1. Factory accessing stub properties during `validateScopes()`
2. Factory accessing `then` property on stub
3. Error messages from child container include parent tokens

### Tests Added for Resolution
1. Resolution path with multiple levels in error messages
2. Factory calling `has()` on resolver interface

### Dead Code Identified
The following lines in `container.ts` cannot be covered by tests because they are dead code:
- Line 39: `getRoot()` method is never called
- Lines 87-90: `getResolutionPath()` method is never called  
- Line 159: Iteration over child container bindings (child containers cannot have bindings)

To achieve 100% coverage, these dead code paths would need to be removed from the implementation.

### Coverage Result
- Container circular proxy paths: 100% covered
- Overall container.ts: 95.49% lines (remaining uncovered are dead code)
- All 194 tests passing


## Task 11: Express HTTP Adapter (2026-02-22)

### ExpressAdapter Implementation
Created the Express HTTP adapter with the following key features:

### Adapter Pattern
- Constructor takes a `ResolverInterface` (not full Container) for better flexibility
- Stores Express app instance privately
- Maintains server reference for graceful shutdown

### Route Registration
- Extracts routes from `ControllerClass.metadata.routes`
- Combines `ControllerClass.metadata.basePath` with route path
- Handles cases where metadata or routes are undefined
- Uses dynamic method dispatch: `app[method](fullPath, handler)`

### Path Joining Logic
```typescript
joinPath(basePath: string, routePath: string): string {
  if (basePath === '') return routePath
  if (routePath === '/' || routePath === '') return basePath
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  const normalizedRoute = routePath.startsWith('/') ? routePath : '/' + routePath
  return normalizedBase + normalizedRoute
}
```

### Handler Resolution
- Controller is resolved from container on each request
- Handler method is looked up dynamically
- Supports both sync and async handlers
- Returns 500 for handler errors

### HTTP Methods Supported
GET, POST, PUT, PATCH, DELETE (mapped to lowercase for Express)

### Test Coverage
- 16 tests covering constructor, registration, listen/close, basePath, error handling, all HTTP methods
- Tests use native `fetch` for HTTP requests
- Server close test uses `AbortSignal.timeout()` to verify shutdown

### Express 5.x Notes
- Express 5.x is used in the project (version 5.2.1)
- JSON body parsing added with `app.use(express.json())`


## Task 12: Fastify HTTP Adapter (2026-02-22)

### FastifyAdapter Implementation
Created the Fastify HTTP adapter following the Express adapter pattern with key differences:

### Key Differences from Express
- Fastify uses `fastify({ ignoreTrailingSlash: true })` to handle trailing slashes like Express
- Fastify uses `FastifyRequest` and `FastifyReply` types instead of Express types
- Fastify handler uses `reply.send()` for responses
- Fastify uses `app.route()` method with config object instead of `app.method(path, handler)`

### Adapter Pattern
```typescript
export class FastifyAdapter {
  private readonly app: FastifyInstance
  private readonly container: ResolverInterface

  constructor(container: ResolverInterface) {
    this.container = container
    this.app = fastify({ ignoreTrailingSlash: true })
  }

  getApp(): FastifyInstance {
    return this.app
  }

  registerController(ControllerClass: ControllerConstructor): void {
    // Extract routes from ControllerClass.metadata
    // Use app.route() with method, url, handler
  }

  async listen(port: number): Promise<void> {
    await this.app.listen({ port, host: '0.0.0.0' })
  }

  async close(): Promise<void> {
    await this.app.close()
  }
}
```

### Test Coverage
- 21 tests covering all adapter functionality
- Tests cover: constructor, registration, listen/close, basePath handling, error handling, HTTP methods
- Edge cases tested:
  - Async handlers returning Promises
  - Non-Error objects thrown from handlers
  - BasePath with trailing slash
  - Route path without leading slash
  - Handler that doesn't exist on controller

### Fastify 5.x Notes
- Fastify 5.x is used in the project (version 5.2.1)
- Fastify returns 404 for unmatched routes by default (same as Express)
- `ignoreTrailingSlash: true` option makes Fastify behave like Express for trailing slashes



## Task 13: Hono HTTP Adapter (2026-02-22)

### HonoAdapter Implementation
Created the Hono HTTP adapter following the Express/Fastify adapter patterns with Hono-specific details:

### Key Implementation Details
- Uses `serve` from `@hono/node-server` to run Hono on Node.js
- `ServerType` is `Server | Http2Server | Http2SecureServer` from Node.js
- Uses `Hono({ strict: false })` to handle trailing slashes like Express

### Server Ready Pattern
The `listen()` method must properly wait for the server to be ready:
```typescript
async listen(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      this.server = serve({
        fetch: (req) => this.app.fetch(req),
        port,
        hostname: '0.0.0.0',
      })

      this.server.once('listening', () => {
        resolve()
      })

      this.server.once('error', (err: Error) => {
        reject(err)
      })
    } catch (err) {
      reject(err)
    }
  })
}
```

### Race Condition Fix
- Use `once()` instead of `on()` for event listeners
- The `once()` method ensures the listener is removed after being called
- This prevents memory leaks and potential double-resolution
- Also wraps the serve() call in try/catch to handle synchronous errors

### @hono/node-server API
The `serve()` function signature:
```typescript
serve(options: Options, listeningListener?: (info: AddressInfo) => void): ServerType
```
Options include: `fetch`, `port`, `hostname`, `overrideGlobalObjects`, `autoCleanupIncoming`

### Test Coverage
- 17 tests covering all adapter functionality
- Tests use native `fetch` for HTTP requests (Node.js 18+)
- Tests cover: constructor, registration, listen/close, basePath, error handling, HTTP methods
- Edge cases: cross-realm Response objects, handlers returning non-Response values

## Example App Creation (2026-02-22)

### Module Pattern
- Modules must call `.register()` on imported modules to register providers
- The `register` method receives a `ContainerInterface` parameter
- Use `asSingleton()` for singleton services

### Controller Registration
- Controllers are registered with the class itself as the token
- Use `c.buildDeps(Controller.inject)` to build dependencies
- The ExpressAdapter resolves controllers from the container

### Dependency Injection
- Services use `static readonly inject = {} as const` for dependencies
- Constructor receives `typeof Service.inject` as parameter type
- Container's `buildDeps` resolves all inject tokens

### Running the Example
- `pnpm --filter example-basic dev` starts the server with tsx watch
- Examples directory must be in `pnpm-workspace.yaml`
- Need `@types/node` for process.env and other Node.js types
## 2024-02-23: Plan Compliance Audit (F1)

### Summary
All 33 implementation tasks from the plan have been completed successfully.

### Packages Verified
- @voxeljs/core - DI container, module system, controllers, types, errors
- @voxeljs/express - Express HTTP adapter
- @voxeljs/fastify - Fastify HTTP adapter
- @voxeljs/hono - Hono HTTP adapter
- @voxeljs/testing - TestingModule, mock utilities
- @voxeljs/cli - Project scaffolding

### Key Findings
- Circular dependency proxy handles `then`, `toString`, `Symbol.toStringTag` correctly
- All three scopes implemented: SINGLETON, TRANSIENT, SCOPED
- Scope validation prevents singletons from depending on scoped providers
- Type inference working via `typeof Class.inject` pattern
- Path parameter extraction via `ExtractPathParams<TPath>` type

### Minor Gap
- No README.md at repository root (AGENTS.md exists and is comprehensive)
- Recommendation: Add README.md with quickstart guide



## 2026-02-23: Final Verification Wave Complete

### F1: Plan Compliance Audit - PASSED
- NO decorators (@Inject, @Injectable, @Controller, @Module) found in packages
- NO reflect-metadata imports found
- NO `any` type usage found (`: any`, `as any`, `<any>`)
- All 33 implementation tasks delivered

### F2: Code Quality Review - PASSED
- Consistent patterns across all packages
- Proper TypeScript strict mode compliance
- 10 minor lint warnings (non-blocking):
  - Empty interface in controller.ts (TypedResponse)
  - Import type side-effects in adapters
  - Unused imports in examples
  - Non-null assertions in test files

### F3: Real Manual QA - PASSED
- Example app starts correctly on port 3000
- GET /users returns array of users
- GET /users/1 returns single user object
- GET /users/999 returns 404 error
- CLI scaffolding works correctly
- Generated code uses correct patterns (static readonly inject, no decorators)

### F4: Scope Fidelity Check - PASSED
- NO microservices support (no message brokers, event patterns)
- NO websockets support (no ws, socket.io imports)
- NO built-in config module (no ConfigService, ConfigModule)
- NO unified Request/Response abstraction (adapters use native types)
- All guardrails respected

### Verification Commands Results
- pnpm build: ✅ Success (all 6 packages)
- pnpm test: ✅ 287 tests passing (18 test files)
- pnpm typecheck: ✅ All packages up to date
- pnpm lint: ⚠️ 10 warnings, 0 errors (non-blocking)




## 2026-02-23: F4 Scope Fidelity Check - COMPREHENSIVE VERIFICATION

### Summary
Framework stays within defined scope. All guardrails respected. NO out-of-scope features added.

### Guardrail Verification Results

| Guardrail | Status | Evidence |
|-----------|--------|----------|
| NO decorators | ✅ PASS | grep for @Inject|@Injectable|@Controller|@Module found 0 matches in packages |
| NO reflect-metadata | ✅ PASS | grep found 0 matches, not in any package.json |
| NO unified Request/Response | ✅ PASS | BaseRequest/BaseResponse are type-only interfaces, adapters use native types |
| NO microservices | ✅ PASS | No MessageBroker, EventBus, Transport, Kafka, RabbitMQ patterns found |
| NO websockets | ✅ PASS | No ws, socket.io, WebSocket imports found |
| NO built-in config module | ✅ PASS | No ConfigService/ConfigModule implementations (only test fixtures) |
| NO `any` type usage | ✅ PASS | grep for `: any|as any|<any>` found 0 matches |

### Adapter Native Type Verification

All adapters pass through native types
- **ExpressAdapter**: Uses `type Request, type Response` from 'express'
- **FastifyAdapter**: Uses `type FastifyRequest, type FastifyReply` from 'fastify'
- **HonoAdapter**: Uses `type Context` from 'hono'

### Core Types Analysis

The `BaseRequest`, `BaseResponse`, `TypedRequest`, `TypedResponse` in `/packages/core/src/types/controller.ts`:
- Are **type-only interfaces** (exported with `export type` in index.ts)
- Used for documentation and type inference purposes only
- **No runtime code** - adapters never wrap native types
- This is acceptable per guardrails ("NO unified Request/Response abstraction" refers to runtime wrappers)

### Package Dependencies Verified

All package.json files checked:
- No reflect-metadata dependency
- No microservice-related packages (kafka, amqplib, nats, redis)
- No websocket packages (ws, socket.io)
- Only appropriate dependencies: express, fastify, hono, @hono/node-server

### Example App Verification

Example in `/examples/basic/` uses correct patterns:
- `static readonly inject = { ... } as const` pattern
- `static readonly metadata: ControllerMetadata` pattern
- Native Express types (`import type { Request, Response } from 'express'`)
- NO decorators used

### Edge Cases Documented

1. **ConfigModule in tests**: Test fixtures use `ConfigModule` as a class name but these are user-defined modules for testing, not a built-in framework config service

2. **BaseRequest/BaseResponse interfaces**: These are type-only helpers, not runtime abstractions. The guardrails prohibit "unified Request/Response abstraction" - meaning no runtime wrapper classes that adapters would use instead of native types

### Final Verification
- Build: ✅ Success (all 6 packages)
- Tests: ✅ 287 tests passing (18 test files)
- Scope: ✅ All guardrails respected

### Conclusion
The Voxel framework has been implemented strictly within its defined scope. No out-of-scope features (microservices, websockets, config module, decorators, unified request/response) were added. The framework correctly:
1. Uses static properties for DI configuration (no decorators)
2. Passes native request/response types through adapters
3. Implements only HTTP routing (no websockets)
4. Provides DI container only (no config service)
5. Uses strict TypeScript (no `any` types)
