# Voxel

A dependency injection framework for TypeScript. No decorators, no reflect-metadata. Just classes with static properties.

## Why Voxel?

Most DI frameworks lean heavily on decorators and runtime metadata. Voxel takes a different path. Everything is explicit. Dependencies are declared in static properties. Types flow naturally from those declarations.

```typescript
class UserService {
  static readonly inject = {
    db: 'Database',
    logger: 'Logger',
  } as const;

  constructor(private deps: typeof UserService.inject) {}

  async getUser(id: string) {
    this.deps.logger.info(`Getting user ${id}`);
    return this.deps.db.query('SELECT * FROM users WHERE id = $1', [id]);
  }
}
```

That's it. No `@Injectable()`, no `@Inject('Database')`. The `inject` static property tells the container what this service needs. The constructor type is inferred from that property.

## Features

- **Dependency injection** with three scopes: singleton, transient, and request-scoped
- **Module system** with proper encapsulation and imports
- **Controller-based routing** with type-safe path parameters
- **Multiple HTTP adapters**: Express, Fastify, and Hono
- **Lifecycle hooks** for initialization and cleanup
- **Circular dependency support** via transparent proxies
- **Clear error messages** with full resolution context

## Installation

```bash
# Core DI container and module system
pnpm add @voxeljs/core

# Pick an HTTP adapter
pnpm add @voxeljs/express   # or @voxeljs/fastify or @voxeljs/hono
```

## Quick Start

Build a simple API with users.

### 1. Define a service

```typescript
// services/user.service.ts
import type { Request, Response } from 'express';

export class UserService {
  static readonly inject = {} as const;

  constructor(private deps: typeof UserService.inject) {}

  private users = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ];

  async findAll() {
    return this.users;
  }

  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async create(data: { name: string }) {
    const user = { id: String(this.users.length + 1), ...data };
    this.users.push(user);
    return user;
  }
}
```

### 2. Define a controller

```typescript
// controllers/user.controller.ts
import type { Request, Response } from 'express';
import type { ControllerRoute } from '@voxeljs/core';
import { UserService } from './services/user.service.ts';

export class UserController {
  static readonly inject = { users: UserService } as const;

  static readonly routes = [
    { method: 'GET', path: '/users', handler: 'list' },
    { method: 'GET', path: '/users/:id', handler: 'get' },
    { method: 'POST', path: '/users', handler: 'create' },
  ] as const satisfies ControllerRoute<UserController>[];

  constructor(private deps: typeof UserController.inject) {}

  async list(_req: Request, res: Response) {
    const users = await this.deps.users.findAll();
    res.json(users);
  }

  async get(req: Request, res: Response) {
    const user = await this.deps.users.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(user);
  }

  async create(req: Request, res: Response) {
    const user = await this.deps.users.create(req.body);
    res.status(201).json(user);
  }
}
```

The `satisfies ControllerRoute<UserController>[]` pattern does two things. It validates that handler names like `'list'` and `'get'` actually exist on the controller. It also enables type inference for `req.params` based on the path.

### 3. Define a module

```typescript
// modules/user.module.ts
import { Module } from '@voxeljs/core';
import { UserService } from './services/user.service.ts';
import { UserController } from './controllers/user.controller.ts';

export class UserModule extends Module {
  static readonly metadata = {
    providers: [UserService],
    controllers: [UserController],
    exports: [UserService],
  };
}
```

### 4. Bootstrap the app

```typescript
// main.ts
import { Container } from '@voxeljs/core';
import { ExpressAdapter } from '@voxeljs/express';
import { UserModule } from './modules/user.module.ts';
import { UserService } from './services/user.service.ts';
import { UserController } from './controllers/user.controller.ts';

const container = new Container();

// Register providers
container
  .register(UserService, (c) => {
    return new UserService(c.buildDeps(UserService.inject));
  })
  .asSingleton();

// Register controllers
container
  .register(UserController, (c) => {
    return new UserController(c.buildDeps(UserController.inject));
  })
  .asTransient();

// Create adapter and register routes
const adapter = new ExpressAdapter(container);
adapter.registerController(UserController);

// Start server
await adapter.listen(3000);
console.log('Server running on http://localhost:3000');
```

Run it:

```bash
tsx main.ts
```

## Core Concepts

### Dependency Injection

Voxel's DI container manages object creation and dependency resolution. Register a provider, then resolve it.

```typescript
import { Container } from '@voxeljs/core';

const container = new Container();

// Register with a token
container.register('Logger', (c) => new ConsoleLogger()).asSingleton();

// Resolve it
const logger = container.resolve('Logger');
```

#### Scopes

Three scopes control instance lifetime:

- **Singleton**: One instance shared everywhere. Created once, cached forever.
- **Transient**: New instance on every resolution.
- **Scoped**: One instance per scope (useful for request contexts).

```typescript
container.register('Cache', CacheService).asSingleton();
container.register('Validator', Validator).asTransient();
container.register('RequestContext', RequestContext).asScoped();
```

#### Circular Dependencies

Voxel handles circular dependencies automatically. Services can depend on each other without special workarounds.

```typescript
class ServiceA {
  static readonly inject = { b: 'ServiceB' } as const;
  constructor(private deps: typeof ServiceA.inject) {}
}

class ServiceB {
  static readonly inject = { a: 'ServiceA' } as const;
  constructor(private deps: typeof ServiceB.inject) {}
}

// This works. Voxel uses proxies to break the cycle.
container.register('ServiceA', ServiceA).asSingleton();
container.register('ServiceB', ServiceB).asSingleton();
```

### Modules

Modules organize related providers and controllers. They define boundaries for dependency visibility.

```typescript
import { Module } from '@voxeljs/core';

class DatabaseModule extends Module {
  static readonly metadata = {
    providers: [Database, Migrator],
    exports: [Database], // Only Database is visible to importers
  };
}

class UserModule extends Module {
  static readonly metadata = {
    imports: [DatabaseModule], // Get Database from here
    providers: [UserService, UserRepository],
    controllers: [UserController],
    exports: [UserService],
  };
}
```

The module metadata properties:

- `imports` - Other modules whose exported providers become available
- `providers` - Services registered in this module
- `controllers` - HTTP route handlers
- `exports` - Providers visible to modules that import this one

### Controllers

Controllers group related routes. The `routes` array maps HTTP methods and paths to handler methods.

```typescript
import type { ControllerRoute } from '@voxeljs/core';

class ProductController {
  static readonly inject = { products: 'ProductService' } as const;

  static readonly routes = [
    { method: 'GET', path: '/products', handler: 'list' },
    { method: 'GET', path: '/products/:id', handler: 'get' },
    { method: 'POST', path: '/products', handler: 'create' },
    { method: 'PUT', path: '/products/:id', handler: 'update' },
    { method: 'DELETE', path: '/products/:id', handler: 'remove' },
  ] as const satisfies ControllerRoute<ProductController>[];

  constructor(private deps: typeof ProductController.inject) {}

  async list(req: Request, res: Response) {
    /* ... */
  }
  async get(req: Request, res: Response) {
    /* ... */
  }
  // ...
}
```

Path parameters are typed. If your route is `/products/:id`, TypeScript knows `req.params.id` exists.

### Lifecycle Hooks

Services can hook into module initialization and destruction.

```typescript
import type { OnModuleInit, OnModuleDestroy } from '@voxeljs/core';

class Database implements OnModuleInit, OnModuleDestroy {
  static readonly inject = { config: 'Config' } as const;
  constructor(private deps: typeof Database.inject) {}

  private connection: Connection | null = null;

  async onModuleInit() {
    this.connection = await connect(this.deps.config.databaseUrl);
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }
}
```

### HTTP Adapters

Voxel ships with three adapters. They all work the same way.

```typescript
// Express
import { ExpressAdapter } from '@voxeljs/express';
const adapter = new ExpressAdapter(container);

// Fastify
import { FastifyAdapter } from '@voxeljs/fastify';
const adapter = new FastifyAdapter(container);

// Hono
import { HonoAdapter } from '@voxeljs/hono';
const adapter = new HonoAdapter(container);

// Usage is identical
adapter.registerController(UserController);
await adapter.listen(3000);
await adapter.close();
```

Adapters pass through native request and response types. No wrapper abstractions.

## Error Messages

Voxel errors include context to help debug issues.

```
TokenNotFoundError: Token 'Logger' not found
  Resolution path: App -> UserModule -> UserService -> Logger
  Available tokens: Database, Config, Cache
  Suggestion: Did you mean to import a module that provides 'Logger'?
```

You can see the full dependency chain and what tokens are actually registered.

## Testing

The `@voxeljs/testing` package provides utilities for testing modules in isolation.

```typescript
import { describe, it, expect } from 'vitest';
import { Test } from '@voxeljs/testing';
import { UserService } from './user.service.ts';

describe('UserService', () => {
  it('returns user by id', async () => {
    const module = await Test.createModule({
      providers: [UserService],
    });

    const service = module.get(UserService);
    const user = await service.findById('1');

    expect(user).toEqual({ id: '1', name: 'Alice' });
  });
});
```

## Packages

| Package            | Description                                         |
| ------------------ | --------------------------------------------------- |
| `@voxeljs/core`    | DI container, modules, controllers, lifecycle hooks |
| `@voxeljs/express` | Express HTTP adapter                                |
| `@voxeljs/fastify` | Fastify HTTP adapter                                |
| `@voxeljs/hono`    | Hono HTTP adapter                                   |
| `@voxeljs/testing` | Testing utilities                                   |
| `@voxeljs/cli`     | Project scaffolding                                 |

## Philosophy

**Explicit over implicit.** Dependencies are declared in static properties, not hidden in decorators. You can see what a class needs by looking at its `inject` property.

**Type-safe by default.** The `satisfies ControllerRoute<T>[]` pattern catches typos in handler names. Path parameters are inferred from route strings.

**No magic.** No reflect-metadata. No decorator processors. No hidden runtime behavior. What you write is what runs.

## License

MIT
