# AGENTS.md - Voxel Framework AI Guidelines

## Project Overview

Voxel is a NestJS-like dependency injection framework WITHOUT decorators or reflect-metadata. Class-based API with static properties for configuration.

**Key Philosophy**: Explicit over implicit, type-safe by default.

The framework provides:
- Dependency injection with singleton, transient, and request-scoped lifecycles
- Module system with proper encapsulation
- Controller-based HTTP routing with type-safe path parameters
- Multiple HTTP adapters (Express, Fastify, Hono)
- Full lifecycle hooks

## Architecture

### Core Packages
- `@voxeljs/core` - DI container, module system, controllers, services, lifecycle
- `@voxeljs/express` - Express HTTP adapter
- `@voxeljs/fastify` - Fastify HTTP adapter
- `@voxeljs/hono` - Hono HTTP adapter
- `@voxeljs/testing` - Testing utilities with mock support
- `@voxeljs/cli` - Project scaffolding CLI

### DI Container

The container manages provider registration and resolution. Three scopes are supported:

- **Singleton** - One instance shared across the application
- **Transient** - New instance created on every resolution
- **Request-scoped** - One instance per request (child container pattern)

### Module System

Modules encapsulate providers, controllers, and imports. Key concepts:

- **imports** - Other modules whose exported providers are available
- **providers** - Services registered in this module
- **controllers** - HTTP route handlers
- **exports** - Providers visible to importing modules

### Controllers and Routes

Controllers define HTTP routes using a static `routes` array. The `satisfies ControllerRoute<Controller>[]` pattern enables:
- Type-safe handler name validation
- Path parameter inference for `req.params`

## Code Conventions

### Service Pattern

```typescript
// CORRECT: Class with static inject
class UserService {
  static readonly inject = {
    db: 'Database',
    logger: 'Logger'
  } as const
  
  constructor(private deps: typeof UserService.inject) {}
  
  async getUser(id: string) {
    this.deps.logger.info(`Getting user ${id}`)
    return this.deps.db.query(...)
  }
}
```

### Controller Pattern

```typescript
// CORRECT: Static routes array with type inference
class UserController {
  static readonly inject = {
    users: 'UserService'
  } as const
  
  static readonly routes = [
    { method: 'GET', path: '/users/:id', handler: 'getUser' },
    { method: 'POST', path: '/users', handler: 'createUser' }
  ] as const satisfies ControllerRoute<UserController>[]
  
  constructor(private deps: typeof UserController.inject) {}
  
  async getUser(req: Request, res: Response) {
    // req.params.id is typed!
    const user = await this.deps.users.getUser(req.params.id)
    res.json(user)
  }
  
  async createUser(req: Request, res: Response) {
    const user = await this.deps.users.createUser(req.body)
    res.status(201).json(user)
  }
}
```

### Module Pattern

```typescript
// CORRECT: Static imports/exports
class UserModule {
  static readonly imports = [DatabaseModule, LoggerModule]
  static readonly providers = [UserService]
  static readonly controllers = [UserController]
  static readonly exports = [UserService]
}
```

### Provider Registration

```typescript
// CORRECT: Fluent binding API
container.register('Logger', Logger).asSingleton()
container.register('Database', Database).asTransient()
container.register('RequestContext', RequestContext).asScoped()
```

### Circular Dependencies

Voxel supports circular dependencies via proxy pattern:

```typescript
// This works - circular dependencies are allowed
class ServiceA {
  static readonly inject = { serviceB: 'ServiceB' } as const
  constructor(private deps: typeof ServiceA.inject) {}
}

class ServiceB {
  static readonly inject = { serviceA: 'ServiceA' } as const
  constructor(private deps: typeof ServiceB.inject) {}
}
```

## Testing Strategy

- **TDD**: Write tests first
- **100% coverage**: Enforced on all packages
- **Framework**: vitest
- **Pattern**: Arrange-Act-Assert

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('UserService', () => {
  it('should return user by id', async () => {
    // Arrange
    const mockDb = { query: vi.fn().mockResolvedValue({ id: '1' }) }
    const mockLogger = { info: vi.fn() }
    const service = new UserService({ db: mockDb, logger: mockLogger })
    
    // Act
    const result = await service.getUser('1')
    
    // Assert
    expect(result).toEqual({ id: '1' })
    expect(mockLogger.info).toHaveBeenCalledWith('Getting user 1')
  })
})
```

## Commit Conventions

Use conventional commits:

- `feat(core): add container bindings`
- `fix(di): handle circular dependencies`
- `docs: update AGENTS.md`
- `test(express): add adapter tests`
- `refactor(module): simplify import resolution`
- `chore: update dependencies`

## Guardrails

### MUST NOT

- Use decorators anywhere (`@Inject`, `@Injectable`, `@Controller`, etc.)
- Use reflect-metadata
- Create unified Request/Response abstractions (pass through native)
- Support microservices (out of scope)
- Support websockets (out of scope)
- Add built-in config module (external only)
- Use `any` type
- Over-abstract or add generic names

### MUST

- Use class-based API with static properties
- Use type inference from static properties
- Maintain 100% test coverage
- Follow existing patterns in codebase
- Write clear error messages with context

## Common Patterns

### Error Messages

All DI errors include resolution context:

```
TokenNotFoundError: Token 'Logger' not found
  Resolution path: App -> UserModule -> UserService -> Logger
  Available tokens: Database, Config, Cache
  Did you mean to import LoggerModule?
```

### Lifecycle Hooks

```typescript
class DatabaseService implements OnModuleInit, OnModuleDestroy {
  static readonly inject = { config: 'Config' } as const
  constructor(private deps: typeof DatabaseService.inject) {}
  
  async onModuleInit() {
    // Connect to database
  }
  
  async onModuleDestroy() {
    // Close connections
  }
}
```

### Request-Scoped Services

```typescript
// Request-scoped via child container
class RequestContext {
  static readonly inject = {} as const
  constructor(private deps: typeof RequestContext.inject) {}
  
  // New instance per request
}

// In adapter
app.use((req, res, next) => {
  const scope = container.createScope()
  req.container = scope
  next()
})
```

## Project Structure

```
voxel/
  packages/
    core/
      src/
        container/    # DI container, scopes, resolution
        module/       # Module system
        controller/   # Route handling
        errors/       # Error classes
        types/        # Type definitions
      tests/
    express/
      src/
        adapter.ts    # Express adapter
    fastify/
      src/
        adapter.ts    # Fastify adapter
    hono/
      src/
        adapter.ts    # Hono adapter
    testing/
      src/
        module.ts     # TestingModule builder
        mock.ts       # Mock utilities
    cli/
      src/
        commands/     # CLI commands
```
