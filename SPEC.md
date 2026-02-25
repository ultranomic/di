# @ultranomic/di Library Specification

> Dependency injection framework for TypeScript with zero decorators and full type safety.

## Design Philosophy

- **No decorators** - Uses static class properties instead
- **No reflect-metadata** - Everything is explicit
- **Class-only tokens** - Uses class constructors as dependency tokens
- **Type-safe by default** - Leverages TypeScript's type system for compile-time validation

---

## Core API

### Types

#### `Token<T>`

Class constructor token for provider identification.

```typescript
type Token<T> = abstract new (...args: any[]) => T;
```

#### `DependencyTokens<T>`

Validates that inject arrays match constructor parameters type-safely.

```typescript
type DependencyTokens<T> = readonly Token<any>[];
```

#### `InferInjectedInstanceTypes<T>`

Extracts resolved types from an inject array.

```typescript
type InferInjectedInstanceTypes<T extends readonly Token<any>[]> = {
  [K in keyof T]: InstanceType<T[K]>;
};
```

#### `InjectableClass<TInject, TInstance>`

Type for classes using the inject pattern.

```typescript
type InjectableClass<TInject extends readonly Token<any>[], TInstance> = {
  readonly inject: TInject;
  new (...args: InferInjectedInstanceTypes<TInject>): TInstance;
};
```

#### `Scope`

Provider lifecycle scope enum.

```typescript
enum Scope {
  SINGLETON = 'singleton', // Single instance for container lifetime
  TRANSIENT = 'transient', // New instance on every resolution
  SCOPED = 'scoped', // Single instance per scope (child container)
}
```

### Container

The main DI container for registration and resolution.

#### Constructor

```typescript
new Container(parent?: Container)
```

#### Methods

| Method        | Signature                                                       | Description                                      |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `register`    | `register<T>(token: Token<T>, options?: RegisterOptions): void` | Register a class with optional scope             |
| `resolve`     | `resolve<T>(token: Token<T>): T`                                | Resolve a dependency by token                    |
| `has`         | `has(token: Token<any>): boolean`                               | Check if token is registered                     |
| `createScope` | `createScope(): Container`                                      | Create a child container for scoped dependencies |

#### RegisterOptions

```typescript
interface RegisterOptions {
  scope?: Scope; // Default: Scope.SINGLETON
}
```

#### Usage

```typescript
const container = new Container();

// Register providers
container.register(UserService); // singleton (default)
container.register(Validator, { scope: Scope.TRANSIENT }); // transient
container.register(RequestContext, { scope: Scope.SCOPED }); // scoped

// Resolve dependencies
const service = container.resolve(UserService);

// Create scope for scoped dependencies
const scope = container.createScope();
const scopedContext = scope.resolve(RequestContext);
```

---

## Module System

### Module

Abstract base class for organizing related providers and controllers.

#### ModuleMetadata

```typescript
interface ModuleMetadata {
  imports?: readonly ModuleClass[]; // Imported modules
  providers?: readonly Token[]; // Service providers
  controllers?: readonly ControllerConstructor[]; // HTTP controllers
  exports?: readonly Token[]; // Tokens visible to importers
}
```

#### Definition

```typescript
class UserModule extends Module {
  static readonly metadata = {
    imports: [DatabaseModule],
    providers: [UserService, UserRepository],
    controllers: [UserController],
    exports: [UserService],
  } as const satisfies ModuleMetadata;
}
```

### ModuleRegistry

Orchestrates module loading with proper import resolution and dependency order.

#### Methods

| Method        | Signature                                          | Description                                |
| ------------- | -------------------------------------------------- | ------------------------------------------ |
| `register`    | `register(moduleClass: ModuleConstructor): void`   | Register a module class                    |
| `loadModules` | `loadModules(container: Container): Promise<void>` | Load all registered modules into container |

#### Usage

```typescript
const registry = new ModuleRegistry();
registry.register(UserModule);
registry.register(DatabaseModule);
registry.register(AuthModule);

const container = new Container();
await registry.loadModules(container);
```

### Module Encapsulation

- **Private by default**: Providers not in `exports` are only visible within the module
- **Explicit exports**: Only exported tokens are available to importing modules
- **Import chain**: Imported modules' exports become available

---

## Lifecycle Hooks

### OnModuleInit

```typescript
interface OnModuleInit {
  onModuleInit(): void | Promise<void>;
}
```

Called after the module and all its dependencies are initialized.

### OnModuleDestroy

```typescript
interface OnModuleDestroy {
  onModuleDestroy(): void | Promise<void>;
}
```

Called when the container is being destroyed.

#### Usage

```typescript
class DatabaseService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }
}
```

---

## Controllers

### Controller

Abstract base class for HTTP route handlers.

#### ControllerMetadata

```typescript
interface ControllerMetadata<T> {
  basePath?: string; // URL prefix for all routes
  routes?: readonly ControllerRoute<T>[]; // Route definitions
}
```

#### ControllerRoute

```typescript
interface ControllerRoute<TController> {
  method: HttpMethod; // HTTP method
  path: string; // Route path (e.g., '/', '/:id')
  handler: keyof TController & string; // Handler method name
}
```

#### HttpMethod

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
```

#### Definition

```typescript
class UserController extends Controller {
  static readonly inject = [UserService] as const satisfies DependencyTokens<UserController>;
  static readonly metadata = {
    basePath: '/users',
    routes: [
      { method: 'GET', path: '/', handler: 'list' },
      { method: 'GET', path: '/:id', handler: 'get' },
      { method: 'POST', path: '/', handler: 'create' },
      { method: 'PUT', path: '/:id', handler: 'update' },
      { method: 'DELETE', path: '/:id', handler: 'delete' },
    ],
  } as const satisfies ControllerMetadata<UserController>;

  constructor(private users: UserService) {
    super();
  }

  async list(req: TypedRequest): Promise<TypedResponse> {
    /* ... */
  }
  async get(req: TypedRequest<{ id: string }>): Promise<TypedResponse> {
    /* ... */
  }
  async create(req: TypedRequest<{}, CreateUserDto>): Promise<TypedResponse> {
    /* ... */
  }
}
```

### Request/Response Types

#### BaseRequest

```typescript
interface BaseRequest<TParams = {}, TBody = unknown, TQuery = {}> {
  params: TParams;
  body: TBody;
  query: TQuery;
}
```

#### TypedRequest

```typescript
type TypedRequest<TParams = {}, TBody = unknown, TQuery = {}> = BaseRequest<TParams, TBody, TQuery>;
```

#### TypedResponse

```typescript
interface TypedResponse {
  status: number;
  body: unknown;
}
```

#### ExtractPathParams

```typescript
type ExtractPathParams<TPath> = // Extracts ':param' names as object keys
// Example: ExtractPathParams<'/users/:id/posts/:postId'> = { id: string; postId: string }
```

---

## HTTP Adapters

### Express Adapter

```typescript
import { ExpressAdapter } from '@ultranomic/di/express';

const adapter = new ExpressAdapter(container);
adapter.registerController(UserController);
adapter.registerController(AuthController);
await adapter.listen(3000);

// Access underlying Express app
const app = adapter.getApp();

// Graceful shutdown
await adapter.close();
```

### Fastify Adapter

```typescript
import { FastifyAdapter } from '@ultranomic/di/fastify';

const adapter = new FastifyAdapter(container);
adapter.registerController(UserController);
await adapter.listen(3000);

const app = adapter.getApp();
await adapter.close();
```

### Hono Adapter

```typescript
import { HonoAdapter, createRpcClient } from '@ultranomic/di/hono';

const adapter = new HonoAdapter(container);
adapter.registerController(UserController);
await adapter.listen(3000);

// Create typed RPC client
const client = createRpcClient<typeof adapter>(adapter, 'http://localhost:3000');
const users = await client.users.list();

// Access underlying Hono app
const app = adapter.getApp();
await adapter.close();
```

#### Hono Types

```typescript
type InferHonoAppType<T> = // Infers Hono app type from adapter
type InferRoutesFromApp<T> = // Extracts routes schema from Hono app
type RpcClient<T> = // RPC client type
type AppClient<T> = // App client type

function createRpcClient<T>(adapter: HonoAdapter<T>, baseUrl: string): RpcClient<T>;
function createClientFromApp<T>(app: Hono, baseUrl: string): AppClient<T>;
```

---

## Testing Utilities

### Test Module Creation

```typescript
import { Test } from '@ultranomic/di/testing';

const testingModule = await Test.createModule({
  providers: [UserService, UserRepository],
  controllers: [UserController],
  imports: [DatabaseModule],
}).compile();

// Get resolved instances
const service = testingModule.get(UserService);
const controller = testingModule.get(UserController);
```

### Mocking

```typescript
import { mock } from '@ultranomic/di/testing';

// Create mock implementation
const mockUserService = mock(UserService).use({
  getUsers: () => Promise.resolve([{ id: '1', name: 'Test' }]),
  getUser: (id: string) => Promise.resolve({ id, name: 'Test' }),
});

// Use in test module
const testingModule = await Test.createModule({
  providers: [UserController],
})
  .overrideProvider(UserService, mockUserService)
  .compile();
```

### TestModuleBuilder API

| Method                          | Description                    |
| ------------------------------- | ------------------------------ |
| `providers(providers)`          | Add providers to test module   |
| `controllers(controllers)`      | Add controllers to test module |
| `imports(modules)`              | Import modules                 |
| `overrideProvider(token, mock)` | Replace provider with mock     |
| `compile()`                     | Build and return TestingModule |

### TestingModule API

| Method       | Description                                |
| ------------ | ------------------------------------------ |
| `get(token)` | Resolve a provider from the test container |

---

## Error Handling

### Error Classes

| Error                      | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `DependencyInjectionError` | Base error class for all DI errors               |
| `TokenNotFoundError`       | Token cannot be resolved in container            |
| `TokenCollisionError`      | Token registered more than once                  |
| `CircularDependencyError`  | Circular dependency detected in dependency graph |
| `NonExportedTokenError`    | Token not exported from module                   |
| `ScopeValidationError`     | Invalid scope configuration detected             |

### Error Features

- **Detailed messages** with resolution context
- **Available tokens listing** in TokenNotFoundError
- **Suggestions** for fixing common issues
- **Stack trace support** via custom error base class

---

## Dependency Injection Patterns

### Basic Service

```typescript
class Logger {
  log(message: string) {
    console.log(message);
  }
}

class UserService {
  static readonly inject = [Logger] as const satisfies DependencyTokens<UserService>;

  constructor(private logger: Logger) {}

  getUser(id: string) {
    this.logger.log(`Getting user ${id}`);
    return { id, name: 'John' };
  }
}
```

### Multiple Dependencies

```typescript
class UserService {
  static readonly inject = [Database, Logger, Cache] as const satisfies DependencyTokens<UserService>;

  constructor(
    private db: Database,
    private logger: Logger,
    private cache: Cache,
  ) {}
}
```

### Circular Dependencies

Circular dependencies are handled automatically via transparent proxies.

```typescript
// ServiceA depends on ServiceB
class ServiceA {
  static readonly inject = [ServiceB] as const;
  constructor(private b: ServiceB) {}
}

// ServiceB depends on ServiceA (circular)
class ServiceB {
  static readonly inject = [ServiceA] as const;
  constructor(private a: ServiceA) {}
}

// Both will be resolved correctly via proxy
```

### Scope Validation

The framework validates scope configurations to prevent invalid setups:

- Singleton cannot depend on Scoped/Transient
- Scoped cannot depend on Transient from parent scope

---

## Utility Functions

### joinPath

```typescript
function joinPath(basePath: string, routePath: string): string;
```

Joins base path and route path, handling slashes correctly.

```typescript
joinPath('/api', '/users'); // '/api/users'
joinPath('/api/', '/users'); // '/api/users'
joinPath('/api', 'users'); // '/api/users'
joinPath('', '/users'); // '/users'
```

---

## CLI

### Project Scaffolding

```bash
# Create new project
npx @ultranomic/di new my-project
```

---

## Import Paths

| Path                     | Description                   |
| ------------------------ | ----------------------------- |
| `@ultranomic/di`         | Core DI functionality         |
| `@ultranomic/di/core`    | Core DI functionality (alias) |
| `@ultranomic/di/express` | Express adapter               |
| `@ultranomic/di/fastify` | Fastify adapter               |
| `@ultranomic/di/hono`    | Hono adapter with RPC client  |
| `@ultranomic/di/testing` | Testing utilities             |
| `@ultranomic/di/cli`     | CLI commands                  |

---

## Type Safety Guarantees

1. **Inject validation**: `satisfies DependencyTokens<T>` ensures inject array matches constructor
2. **Route validation**: `satisfies ControllerRoute<T>[]` ensures handler names exist
3. **Path parameter extraction**: `ExtractPathParams<TPath>` derives types from route strings
4. **Module metadata**: Full type checking on imports, providers, controllers, exports
5. **Resolution types**: `resolve<T>` returns correct instance type
