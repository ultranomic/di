# @ultranomic/di

A lightweight, type-safe dependency injection framework for TypeScript applications with comprehensive lifecycle management, layered architecture support, and complete JSDoc documentation.

## Features

- **🏗️ Layered Architecture** - Injectable → Service → Module → Router → App layers
- **🔒 Type-safe dependency injection** - Full TypeScript support with compile-time type checking
- **⚡ Lifecycle management** - Three-phase application hooks (initialized, start, stop)
- **📦 Minimal footprint** - Only depends on `@ultranomic/hook`
- **🚀 ES modules support** - Modern JavaScript module system
- **🔌 Flexible definitions** - Support for components with and without dependencies
- **📖 Complete JSDoc documentation** - Comprehensive API documentation with usage examples
- **✅ Comprehensive test suite** - 6 test files covering all core functionality with Node.js native test runner

## Installation

```bash
npm install @ultranomic/di
# or
pnpm add @ultranomic/di
```

## Architecture

The framework provides a layered architecture with clear separation of concerns:

```
┌─────────────────┐
│   Application   │  ← defineApp (lifecycle orchestration)
├─────────────────┤
│     Module      │  ← defineModule (feature grouping)
├─────────────────┤
│     Router      │  ← defineRouter
├─────────────────┤
│     Service     │  ← defineService (business logic)
├─────────────────┤
│   Injectable    │  ← defineInjectable (base DI layer)
└─────────────────┘
```

## Quick Start

### 1. Basic Service (Business Logic)

```typescript
import { defineService } from '@ultranomic/di';

const userService = defineService.handler(() => ({
  getUser: (id: string) => ({ id, name: `User ${id}` }),
  createUser: (name: string) => ({ id: crypto.randomUUID(), name }),
}));
```

### 2. Service with Dependencies

```typescript
import { defineService, type Service } from '@ultranomic/di';

type Dependencies = {
  database: Service<{ query: (sql: string) => any[] }>;
  logger: Service<{ log: (msg: string) => void }>;
};

const userService = defineService
  .inject<Dependencies>()
  .handler((injector, { onApplicationStart, onApplicationStop }) => {
    const { database, logger } = injector();

    onApplicationStart(() => {
      logger.log('User service initialized');
    });

    return {
      getUser: async (id: string) => {
        logger.log(`Fetching user ${id}`);
        return database.query(`SELECT * FROM users WHERE id = '${id}'`)[0];
      },
    };
  });
```

### 3. Module (Feature Grouping)

```typescript
import { defineModule, type Service } from '@ultranomic/di';

type Dependencies = {
  userService: Service<{ getUser: (id: string) => any }>;
  postService: Service<{ getPostsByUser: (userId: string) => any[] }>;
};

const userModule = defineModule.inject<Dependencies>().handler((injector) => {
  const { userService, postService } = injector();

  return {
    getUserWithPosts: async (userId: string) => {
      const user = await userService.getUser(userId);
      const posts = await postService.getPostsByUser(userId);
      return { user, posts };
    },
  };
});
```

### 4. Router

```typescript
import { defineRouter, type Module } from '@ultranomic/di';

type Dependencies = {
  userModule: Module<{ getUserWithPosts: (id: string) => any }>;
};

const userRouter = defineRouter.inject<Dependencies>().handler((injector) => {
  const { userModule } = injector();

  return {
    '/users/:id': {
      GET: async ({ params }: { params: { id: string } }) => {
        return userModule.getUserWithPosts(params.id);
      },
    },
  };
});
```

### 5. Application (Lifecycle Management)

```typescript
import { defineApp } from '@ultranomic/di';

const app = await defineApp(({ onApplicationStart, onApplicationStop, onApplicationInitialized }) => {
  // Setup services, modules, routers here
  const services = {
    /* your services */
  };

  onApplicationInitialized(() => {
    console.log('App initialized');
  });

  return {
    services,
    // Your app API
  };
});

// Start the application
await app.start();

// Later, stop the application
await app.stop();
```

## API Reference

### Core Utilities

#### `defineInjectable`

Base dependency injection utility - foundation for all other layers.

```typescript
// Without dependencies
const basic = defineInjectable.handler(() => ({ value: 42 }));

// With dependencies
const withDeps = defineInjectable
  .inject<{ dep: Injectable<SomeType> }>()
  .handler((injector, { onApplicationStart, onApplicationStop }) => {
    // Implementation
  });
```

#### `defineService`

Business logic and data access layer. Enforces `object | void` return types.

```typescript
const service = defineService.handler(() => ({
  doSomething: () => 'result',
}));
```

#### `defineModule`

Feature grouping layer. Allows `Record<string | symbol, unknown> | void` return types.

```typescript
const module = defineModule.handler(() => ({
  feature1: () => 'value1',
  feature2: () => 'value2',
}));
```

#### `defineRouter`

HTTP endpoint definitions. Same constraints as modules.

```typescript
const router = defineRouter.handler(() => ({
  '/api/users': { GET: () => users },
}));
```

#### `defineApp`

Application lifecycle orchestration with async hook management.

```typescript
const app = await defineApp(({ onApplicationInitialized, onApplicationStart, onApplicationStop }) => {
  // App setup
  return {
    /* app API */
  };
});
```

### Lifecycle Hooks

All inject-enabled utilities provide lifecycle hooks:

- **`onApplicationInitialized(callback, order?)`** - Fired after app creation
- **`onApplicationStart(callback, order?)`** - Register startup callback
- **`onApplicationStop(callback, order?)`** - Register shutdown callback

**Execution Order**: Lower numbers execute first (default: 0)

## Requirements

- Node.js >= 24.0.0  
- TypeScript compilation via `tsgo` (modern TypeScript toolchain)
- PNPM package manager (v10.15.0)
- Node.js native test runner (no external testing framework dependencies)
- Prettier for code formatting
- All public APIs include comprehensive JSDoc documentation

## Project Structure

```
src/
├── index.ts              # Main entry point with comprehensive JSDoc examples
├── define-app.ts         # Application lifecycle orchestration with async hooks
├── define-injectable.ts  # Core dependency injection foundation
├── define-service.ts     # Business logic and data access layer
├── define-module.ts      # Feature organization and grouping layer
├── define-router.ts      # HTTP endpoint definitions and routing logic
├── *.test.ts            # Comprehensive test suites (6 files total)
└── define-app-isolated.test.ts # Isolated application testing utilities

dist/                     # Built output (ES modules with TypeScript declarations)
├── *.js                 # Compiled JavaScript modules
├── *.d.ts              # TypeScript declaration files
└── *.js.map            # Source maps for debugging
```

## TypeScript Types

```typescript
// Core types
type Injectable<T = unknown> = T;
type Service<T = unknown> = Injectable<T>;
type Module<T = unknown> = Injectable<T>;
type Router<T = unknown> = Injectable<T>;

// Dependency schemas
type Dependencies = Record<string, Injectable<unknown>>;

// Handler signatures
type BasicHandler<S> = () => S;
type InjectHandler<T, S> = (
  injector: () => T,
  hooks: {
    onApplicationStart: (callback: () => unknown, order?: number) => void;
    onApplicationStop: (callback: () => unknown, order?: number) => void;
  },
) => S;
```

## Development

```bash
# Install dependencies
pnpm install

# Build the project (uses tsgo for TypeScript compilation)
npm run build

# Run tests (using Node.js native test runner)
npm test

# Run tests with coverage
npm run test:coverage

# Type check without building
npm run typecheck

# Format code (using Prettier)
npm run format

# Clean build artifacts
npm run clean

# Pre-publish validation
npm run prepublishOnly
```

## License

MIT

## Contributing

Issues and pull requests welcome at [https://github.com/ultranomic/di](https://github.com/ultranomic/di)
