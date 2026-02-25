# Ultranomic DI

A dependency injection framework for TypeScript. No decorators, no reflect-metadata. Just classes with static properties.

## Why Ultranomic DI?

Most DI frameworks lean heavily on decorators and runtime metadata. Ultranomic DI takes a different path. Everything is explicit. Dependencies are declared in static properties. Types flow naturally from those declarations.

```typescript
import type { DependencyTokens } from '@ultranomic/di';

class UserService {
  static readonly inject = [Database, Logger] as const satisfies DependencyTokens<UserService>;

  constructor(
    private db: InstanceType<typeof Database>,
    private logger: InstanceType<typeof Logger>,
  ) {}

  async getUser(id: string) {
    this.logger.info(`Getting user ${id}`);
    return this.db.query('SELECT * FROM users WHERE id = $1', [id]);
  }
}
```

That's it. No `@Injectable()`, no `@Inject('Database')`. The `inject` static property tells the container what this service needs. The constructor types are inferred from that property.

## Features

- **Dependency injection** with three scopes: singleton, transient, and request-scoped
- **Module system** with proper encapsulation and imports
- **Controller-based routing** with type-safe path parameters
- **Multiple HTTP adapters**: Express, Fastify, and Hono
- **Lifecycle hooks** for initialization and cleanup
- **Circular dependency support** via transparent proxies
- **Clear error messages** with full resolution context
- **Class-only tokens** for type-safe dependency resolution

## Installation

```bash
# Core DI container and module system
pnpm add @ultranomic/di

# HTTP adapters are included - just import them:
# import { ExpressAdapter } from '@ultranomic/di/express'
# import { FastifyAdapter } from '@ultranomic/di/fastify'
# import { HonoAdapter } from '@ultranomic/di/hono'
```

## Quick Start

Build a simple API with users.

### 1. Define a service

```typescript
// services/user.service.ts
import type { DependencyTokens } from '@ultranomic/di';

export class UserService {
  static readonly inject = [] as const satisfies DependencyTokens<UserService>;

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
import type { ControllerRoute, DependencyTokens } from '@ultranomic/di';
import { UserService } from './services/user.service.ts';

export class UserController {
  static readonly inject = [UserService] as const satisfies DependencyTokens<UserController>;

  static readonly routes = [
    { method: 'GET', path: '/users', handler: 'list' },
    { method: 'GET', path: '/users/:id', handler: 'get' },
    { method: 'POST', path: '/users', handler: 'create' },
  ] as const satisfies ControllerRoute<UserController>[];

  constructor(private users: UserService) {}

  async list(_req: Request, res: Response) {
    const users = await this.users.findAll();
    res.json(users);
  }

  async get(req: Request, res: Response) {
    const user = await this.users.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(user);
  }

  async create(req: Request, res: Response) {
    const user = await this.users.create(req.body);
    res.status(201).json(user);
  }
}
```

The `satisfies ControllerRoute<UserController>[]` pattern does two things. It validates that handler names like `'list'` and `'get'` actually exist on the controller. It also enables type inference for `req.params` based on the path.

### 3. Define a module

```typescript
// modules/user.module.ts
import { Module } from '@ultranomic/di';
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
import { Container } from '@ultranomic/di';
import { ExpressAdapter } from '@ultranomic/di/express';
import { UserModule } from './modules/user.module.ts';
import { UserService } from './services/user.service.ts';
import { UserController } from './controllers/user.controller.ts';

const container = new Container();

// Register providers - container auto-instantiates using static inject
container.register(UserService);

// Register controllers
container.register(UserController);

// Create adapter and register routes
const adapter = new ExpressAdapter(container);
adapter.registerController(UserController);

// Start server
await adapter.listen(3000);
console.log('Server running on http://localhost:3000');
```

Run it:

```bash
node main.ts
```

## Core Concepts

### Dependency Injection

Ultranomic DI's container manages object creation and dependency resolution. Register a class, then resolve it. The container automatically instantiates using the class's `static inject` property.

```typescript
import { Container } from '@ultranomic/di';
import type { DependencyTokens } from '@ultranomic/di';

class Logger {
  static readonly inject = [] as const satisfies DependencyTokens<Logger>;

  log(message: string) {
    console.log(message);
  }
}

const container = new Container();

// Register with a class token - defaults to singleton scope
container.register(Logger);

// Resolve it
const logger = container.resolve(Logger);
```

#### Scopes

Three scopes control instance lifetime:

- **Singleton**: One instance shared everywhere. Created once, cached forever. (default)
- **Transient**: New instance on every resolution.
- **Scoped**: One instance per scope (useful for request contexts).

```typescript
import { Scope } from '@ultranomic/di';
import type { DependencyTokens } from '@ultranomic/di';

class CacheService {
  static readonly inject = [] as const satisfies DependencyTokens<CacheService>;
}
class Validator {
  static readonly inject = [] as const satisfies DependencyTokens<Validator>;
}
class RequestContext {
  static readonly inject = [] as const satisfies DependencyTokens<RequestContext>;
}

container.register(CacheService); // singleton (default)
container.register(Validator, { scope: Scope.TRANSIENT });
container.register(RequestContext, { scope: Scope.SCOPED });
```

#### Circular Dependencies

DI handles circular dependencies automatically. Services can depend on each other without special workarounds.

```typescript
import type { DependencyTokens } from '@ultranomic/di';

class ServiceA {
  static readonly inject = [ServiceB] as const satisfies DependencyTokens<ServiceA>;
  constructor(private serviceB: ServiceB) {}
}

class ServiceB {
  static readonly inject = [ServiceA] as const satisfies DependencyTokens<ServiceB>;
  constructor(private serviceA: ServiceA) {}
}

// This works. Ultranomic DI uses proxies to break the cycle.
container.register(ServiceA);
container.register(ServiceB);
```

### Modules

Modules organize related providers and controllers. They define boundaries for dependency visibility.

```typescript
import { Module } from '@ultranomic/di';
import type { DependencyTokens } from '@ultranomic/di';

class Database {
  static readonly inject = [] as const satisfies DependencyTokens<Database>;
}
class Migrator {
  static readonly inject = [] as const satisfies DependencyTokens<Migrator>;
}

class DatabaseModule extends Module {
  static readonly metadata = {
    providers: [Database, Migrator],
    exports: [Database], // Only Database is visible to importers
  };
}

class UserService {
  static readonly inject = [] as const satisfies DependencyTokens<UserService>;
}
class UserRepository {
  static readonly inject = [] as const satisfies DependencyTokens<UserRepository>;
}
class UserController {
  static readonly inject = [UserService] as const satisfies DependencyTokens<UserController>;
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
import type { ControllerRoute, DependencyTokens } from '@ultranomic/di';

class ProductService {
  static readonly inject = [] as const satisfies DependencyTokens<ProductService>;
}

class ProductController {
  static readonly inject = [ProductService] as const satisfies DependencyTokens<ProductController>;

  static readonly routes = [
    { method: 'GET', path: '/products', handler: 'list' },
    { method: 'GET', path: '/products/:id', handler: 'get' },
    { method: 'POST', path: '/products', handler: 'create' },
    { method: 'PUT', path: '/products/:id', handler: 'update' },
    { method: 'DELETE', path: '/products/:id', handler: 'remove' },
  ] as const satisfies ControllerRoute<ProductController>[];

  constructor(private products: ProductService) {}

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
import type { OnModuleInit, OnModuleDestroy, DependencyTokens } from '@ultranomic/di';

class Config {
  static readonly inject = [] as const satisfies DependencyTokens<Config>;
}

class Database implements OnModuleInit, OnModuleDestroy {
  static readonly inject = [Config] as const satisfies DependencyTokens<Database>;

  constructor(private config: Config) {}

  private connection: Connection | null = null;

  async onModuleInit() {
    this.connection = await connect();
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }
}
```

### HTTP Adapters

Ultranomic DI ships with three adapters. They all work the same way.

```typescript
// Express
import { ExpressAdapter } from '@ultranomic/di/express';
const adapter = new ExpressAdapter(container);

// Fastify
import { FastifyAdapter } from '@ultranomic/di/fastify';
const adapter = new FastifyAdapter(container);

// Hono
import { HonoAdapter } from '@ultranomic/di/hono';
const adapter = new HonoAdapter(container);

// Usage is identical
adapter.registerController(UserController);
await adapter.listen(3000);
await adapter.close();
```

Adapters pass through native request and response types. No wrapper abstractions.

## Error Messages

Ultranomic DI errors include context to help debug issues.

```
TokenNotFoundError: Token 'Logger' not found
  Resolution path: App -> UserModule -> UserService -> Logger
  Available tokens: Database, Config, Cache
  Suggestion: Did you mean to import a module that provides 'Logger'?
```

You can see the full dependency chain and what tokens are actually registered.

## Testing

The `@ultranomic/di/testing` package provides utilities for testing modules in isolation.

```typescript
import { describe, it, expect } from 'vitest';
import { Test } from '@ultranomic/di/testing';
import { UserService } from './user.service.ts';

describe('UserService', () => {
  it('returns user by id', async () => {
    const module = await Test.createModule({
      providers: [UserService],
    }).compile();

    const service = module.get(UserService);
    const user = await service.findById('1');

    expect(user).toEqual({ id: '1', name: 'Alice' });
  });
});
```

## CLI

Create new projects with the CLI:

```bash
# Create a new project
npx @ultranomic/di new my-app

# Then:
cd my-app
pnpm install
pnpm dev
```

## Packages

| Package                  | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `@ultranomic/di`         | DI container, modules, controllers, lifecycle hooks |
| `@ultranomic/di/express` | Express HTTP adapter                                |
| `@ultranomic/di/fastify` | Fastify HTTP adapter                                |
| `@ultranomic/di/hono`    | Hono HTTP adapter                                   |
| `@ultranomic/di/testing` | Testing utilities                                   |

**Note:** The CLI is included in the main package. Use `npx @ultranomic/di new my-app` to create a new project.

## Philosophy

**Explicit over implicit.** Dependencies are declared in static properties, not hidden in decorators. You can see what a class needs by looking at its `inject` property.

**Type-safe by default.** The `satisfies ControllerRoute<T>[]` pattern catches typos in handler names. Path parameters are inferred from route strings.

**No magic.** No reflect-metadata. No decorator processors. No hidden runtime behavior. What you write is what runs.

## License

MIT
