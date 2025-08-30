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
│   Application   │  ← defineApp (creates app instances)
├─────────────────┤
│     Module      │  ← defineModuleFactoryFactory (creates module factories)
├─────────────────┤
│     Router      │  ← defineRouterFactoryFactory (creates router factories)
├─────────────────┤
│     Service     │  ← defineServiceFactoryFactory (creates service factories)
├─────────────────┤
│   Injectable    │  ← defineInjectableFactoryFactory (creates injectable factories)
└─────────────────┘
```

**Key Distinction**: `defineInjectableFactoryFactory`, `defineModuleFactoryFactory`, `defineRouterFactoryFactory`, and `defineServiceFactoryFactory` are **factory creator functions** that return factory functions. Only `defineApp` creates the actual application instance.

## Quick Start

### 1. Basic Service (Business Logic)

```typescript
import { defineServiceFactoryFactory } from '@ultranomic/di';

// Creates a service factory function
const defineUserService = defineServiceFactoryFactory.handler(() => ({
  getUser: (id: string) => ({ id, name: `User ${id}` }),
  createUser: (name: string) => ({ id: crypto.randomUUID(), name }),
}));
```

### 2. Service with Dependencies

```typescript
import { defineServiceFactoryFactory, type Service } from '@ultranomic/di';

type Dependencies = {
  database: Service<{ query: (sql: string) => any[] }>;
  logger: Service<{ log: (msg: string) => void }>;
};

// Creates a service factory function with dependencies
const defineUserService = defineServiceFactoryFactory
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
import { defineModuleFactory, type Service } from '@ultranomic/di';

type Dependencies = {
  userService: Service<{ getUser: (id: string) => any }>;
  postService: Service<{ getPostsByUser: (userId: string) => any[] }>;
};

// Creates a module factory function
const defineUserModule = defineModuleFactory.inject<Dependencies>().handler((injector) => {
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
import { defineRouterFactory, type Module } from '@ultranomic/di';

type Dependencies = {
  userModule: Module<{ getUserWithPosts: (id: string) => any }>;
};

// Creates a router factory function
const defineUserRouter = defineRouterFactory.inject<Dependencies>().handler((injector) => {
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
import { defineApp, defineModuleFactory } from '@ultranomic/di';

// Create module factory
const defineAppModule = defineModuleFactory.handler(() => {
  const userModule = defineUserModule(); // Creates module instance
  const userRouter = defineUserRouter(); // Creates router instance
  return {
    userRouter,
  };
});

// Create actual app instance using the module factory
const app = await defineApp(defineAppModule);
await app.start();
await app.stop();
```

## API Reference

### Core Utilities

#### `defineInjectableFactory`

Base dependency injection factory creator - foundation for all other layers. Returns injectable factory functions.

```typescript
// Without dependencies - creates injectable factory
const defineBasic = defineInjectableFactory.handler(() => ({ value: 42 }));

// With dependencies - creates injectable factory with dependencies
const defineWithDeps = defineInjectableFactory
  .inject<{ dep: Injectable<SomeType> }>()
  .handler((injector, { onApplicationStart, onApplicationStop }) => {
    // Implementation
  });
```

#### `defineServiceFactory`

Business logic and data access factory creator. Returns service factory functions that enforce `object | void` return types.

```typescript
// Creates a service factory function
const defineMyService = defineServiceFactory.handler(() => ({
  doSomething: () => 'result',
}));
```

#### `defineModuleFactory`

Feature grouping factory creator. Returns module factory functions that allow `Record<string | symbol, unknown> | void` return types.

```typescript
// Creates a module factory function
const defineMyModule = defineModuleFactory.handler(() => ({
  feature1: () => 'value1',
  feature2: () => 'value2',
}));
```

#### `defineRouterFactory`

HTTP endpoint factory creator. Returns router factory functions with same constraints as modules.

```typescript
// Creates a router factory function
const defineMyRouter = defineRouterFactory.handler(() => ({
  '/api/users': { GET: () => users },
}));
```

#### `defineApp`

Application lifecycle orchestration with async hook management. Takes a module factory and creates the actual application instance with lifecycle control.

```typescript
// Create module factory
const defineAppModule = defineModuleFactory.handler(() => {
  const userModule = defineUserModule(); // Creates module instance
  const userRouter = defineUserRouter(); // Creates router instance
  return {
    userRouter,
  };
});

// Create actual app instance (can pass factory directly or as function)
const app = await defineApp(defineAppModule);
// OR
const app = await defineApp(() => defineAppModule);

// App object contains only start() and stop() methods
await app.start(); // Triggers onApplicationStart hooks
await app.stop(); // Triggers onApplicationStop hooks
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
