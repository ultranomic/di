# @voxeljs/core

Core dependency injection container and module system for Voxel framework.

## Installation

```bash
pnpm add @voxeljs/core
```

## Quick Start

```typescript
import { Container } from '@voxeljs/core';

const container = new Container();

// Register a service
container.register('Logger', (c) => new ConsoleLogger()).asSingleton();

// Resolve it
const logger = container.resolve('Logger');
```

## Container

The container manages dependency registration and resolution.

### Register

```typescript
// Register with a string token
container.register('Logger', (c) => new ConsoleLogger());

// Register with a class token
container.register(UserService, (c) => {
  return new UserService(c.buildDeps(UserService.inject));
});

// Register with a symbol token
container.register(Symbol('Config'), (c) => new Config());
```

### Scopes

```typescript
// Singleton - one instance shared everywhere
container.register('Cache', CacheService).asSingleton();

// Transient - new instance on every resolve
container.register('Validator', Validator).asTransient();

// Scoped - one instance per scope
container.register('RequestContext', RequestContext).asScoped();
```

### Resolve

```typescript
const logger = container.resolve('Logger');
const userService = container.resolve(UserService);
```

### Build Dependencies

```typescript
class UserService {
  static readonly inject = {
    db: 'Database',
    logger: 'Logger',
  } as const;

  constructor(private deps: typeof UserService.inject) {}
}

container.register(UserService, (c) => {
  return new UserService(c.buildDeps(UserService.inject));
});
```

### Child Containers

```typescript
// Create a child container for request scoping
const childContainer = container.createScope();

// Scoped providers are unique per child container
const ctx1 = childContainer.resolve('RequestContext');
```

## Modules

Modules organize related providers and controllers.

```typescript
import { Module } from '@voxeljs/core';

class DatabaseModule extends Module {
  static readonly metadata = {
    providers: [Database, Migrator],
    exports: [Database],
  };
}

class UserModule extends Module {
  static readonly metadata = {
    imports: [DatabaseModule],
    providers: [UserService, UserRepository],
    controllers: [UserController],
    exports: [UserService],
  };
}
```

### Module Metadata

- `imports` - Other modules whose exported providers become available
- `providers` - Services registered in this module
- `controllers` - HTTP route handlers
- `exports` - Providers visible to importing modules

## Controllers

Controllers group related routes.

```typescript
import { Controller } from '@voxeljs/core';
import type { ControllerRoute } from '@voxeljs/core';

class UserController extends Controller {
  static readonly inject = { users: UserService } as const;

  static readonly routes = [
    { method: 'GET', path: '/users', handler: 'list' },
    { method: 'GET', path: '/users/:id', handler: 'get' },
    { method: 'POST', path: '/users', handler: 'create' },
  ] as const satisfies ControllerRoute<UserController>[];

  constructor(private deps: typeof UserController.inject) {
    super();
  }

  async list(req: Request, res: Response) {
    const users = await this.deps.users.findAll();
    res.json(users);
  }
}
```

### Path Parameters

The `satisfies ControllerRoute<T>[]` pattern enables type inference for path parameters:

```typescript
// req.params.id is typed as string
{ method: 'GET', path: '/users/:id', handler: 'get' }
```

## Lifecycle Hooks

Services can hook into module lifecycle.

```typescript
import type { OnModuleInit, OnModuleDestroy } from '@voxeljs/core';

class Database implements OnModuleInit, OnModuleDestroy {
  static readonly inject = { config: 'Config' } as const;

  constructor(private deps: typeof Database.inject) {}

  async onModuleInit() {
    // Connect to database
  }

  async onModuleDestroy() {
    // Close connections
  }
}
```

## Error Classes

All errors include resolution context for debugging.

- `TokenNotFoundError` - Token not found in container
- `TokenCollisionError` - Duplicate token registration
- `ScopeMismatchError` - Singleton depends on scoped provider

Example error:

```
TokenNotFoundError: Token 'Logger' not found
  Resolution path: App -> UserModule -> UserService -> Logger
  Available tokens: Database, Config, Cache
  Suggestion: Did you mean to import a module that provides 'Logger'?
```

## Types

### Token

```typescript
type Token<T = unknown> = string | symbol | abstract new (...args: unknown[]) => T
```

### ControllerRoute

```typescript
interface ControllerRoute<T> {
  method: HttpMethod;
  path: string;
  handler: keyof T;
}
```

### ExtractPathParams

```typescript
type Params = ExtractPathParams<'/users/:userId/posts/:postId'>;
// { userId: string; postId: string }
```

### InferInject

```typescript
type Deps = InferInject<['Database', 'Logger'], TokenRegistry>;
```

## License

MIT
