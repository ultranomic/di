# @ultranomic/di

A lightweight, type-safe dependency injection framework for TypeScript applications with comprehensive lifecycle management, layered architecture support, and complete JSDoc documentation.

## Features

- **🏗️ Layered Architecture** - Injectable, Service, Router → Module → App layers
- **🔒 Type-safe dependency injection** - Full TypeScript support with compile-time type checking
- **⚡ Lifecycle management** - Three-phase application hooks (initialized, start, stop)
- **📝 Automatic Logger Injection** - Component-specific loggers with pino integration and automatic prefixes
- **📦 Minimal footprint** - Only depends on `@ultranomic/hook`
- **🚀 ES modules support** - Modern JavaScript module system
- **🔌 Flexible definitions** - Support for injectables with and without dependencies
- **📖 Complete JSDoc documentation** - Comprehensive API documentation with usage examples
- **✅ Comprehensive test suite** - 6 test files with 88 total tests covering all core functionality with Node.js native test runner
- **🏷️ Mandatory naming** - All factory functions require explicit naming for better debugging
- **🎯 Fluent API pattern** - Consistent `.name().inject().handler()` pattern across all factories

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
│     Module      │  ← defineModuleFactory (composes injectables)
├─────────────────┤
│   Injectable    │  ← defineInjectableFactory, defineServiceFactory, defineRouterFactory
│                 │    (creates individual injectables that can be injected)
└─────────────────┘
```

**Layer Responsibilities:**

- **Injectable Layer**: `defineInjectableFactory`, `defineServiceFactory`, `defineRouterFactory` create individual injectables that can be injected and reused
- **Module Layer**: `defineModuleFactory` composes related injectables into feature groups
- **Application Layer**: `defineApp` orchestrates all modules and manages application lifecycle

**Key Distinction**: Injectable factories (`defineInjectableFactory`, `defineServiceFactory`, `defineRouterFactory`) and module factory (`defineModuleFactory`) return factory functions. Only `defineApp` creates the actual application instance.

**Mandatory Pattern**: All factory creators follow the consistent pattern: `.name('InjectableName').inject().handler(...)` or `.name('InjectableName').inject<Dependencies>().handler(...)`.

## Quick Start

### 1. Injectable Layer - Individual Building Blocks

#### Basic Injectable Component

```typescript
import { defineInjectableFactory } from '@ultranomic/di';

// Creates a basic injectable component
const defineConfig = defineInjectableFactory
  .name('Config')
  .inject()
  .handler(() => ({
    port: 3000,
    databaseUrl: 'postgresql://localhost:5432/myapp',
  }));
```

#### Service Component with Business Logic

```typescript
import { defineServiceFactory, type Injectable } from '@ultranomic/di';

type Config = Injectable<{ port: number; databaseUrl: string }>;

type Dependencies = {
  config: Config;
};

// Creates a service component with dependencies
const defineDatabaseService = defineServiceFactory
  .name('DatabaseService')
  .inject<Dependencies>()
  .handler(({ injector }) => {
    const { config } = injector();

    return {
      connect: () => {
        console.log(`Connecting to ${config.databaseUrl}`);
        return { isConnected: true };
      },
      query: (sql: string) => {
        // Database query logic
        return [];
      },
    };
  });
```

#### Router Component for HTTP Endpoints

```typescript
import { defineRouterFactory, type Service } from '@ultranomic/di';

type DatabaseService = Service<{ query: (sql: string) => any[] }>;

type Dependencies = {
  database: DatabaseService;
};

// Creates a router component
const defineApiRouter = defineRouterFactory
  .name('ApiRouter')
  .inject<Dependencies>()
  .handler(({ injector }) => {
    const { database } = injector();

    return {
      '/api/health': {
        GET: () => ({ status: 'ok', timestamp: new Date().toISOString() }),
      },
      '/api/users': {
        GET: () => database.query('SELECT * FROM users'),
      },
    };
  });
```

### 2. Module Layer - Feature Composition

```typescript
import { defineModuleFactory, type Service, type Router } from '@ultranomic/di';

type DatabaseService = Service<{ connect: () => any; query: (sql: string) => any[] }>;
type ApiRouter = Router<Record<string, any>>;

type Dependencies = {
  database: DatabaseService;
  apiRouter: ApiRouter;
};

// Creates a module that composes multiple injectables
const defineApiModule = defineModuleFactory
  .name('ApiModule')
  .inject<Dependencies>()
  .handler(({ injector, appHooks: { onApplicationStart, onApplicationStop } }) => {
    const { database, apiRouter } = injector();

    onApplicationStart(() => {
      database.connect();
      console.log('API Module started');
    });

    onApplicationStop(() => {
      console.log('API Module stopped');
    });

    return {
      // Expose the router for the application layer
      router: apiRouter,

      // Module-specific functionality
      getStats: () => ({
        connected: database.connect().isConnected,
        endpoints: Object.keys(apiRouter),
      }),
    };
  });
```

### 3. Application Layer - Lifecycle Orchestration

```typescript
import { defineApp, defineModuleFactory } from '@ultranomic/di';

// Create the main application module
const defineMainModule = defineModuleFactory
  .name('MainModule')
  .inject()
  .handler(() => {
    // Instantiate all modules
    const apiModule = defineApiModule();

    return {
      // Expose modules and their injectables
      api: apiModule,

      // Application-level utilities
      getHealth: () => ({
        status: 'healthy',
        modules: {
          api: apiModule.getStats(),
        },
      }),
    };
  });

// Create and run the application
const app = await defineApp(defineMainModule);

// Application lifecycle
await app.start(); // Triggers all onApplicationStart hooks
console.log('Application is running...');

// Graceful shutdown
await app.stop(); // Triggers all onApplicationStop hooks
```

## API Reference

### Core Utilities

#### `defineInjectableFactory`

Base dependency injection factory creator - foundation for all other layers. Returns injectable factory functions.

```typescript
// Without dependencies - creates injectable factory
const defineBasic = defineInjectableFactory
  .name('BasicComponent')
  .inject()
  .handler(() => ({ value: 42 }));

// With dependencies - creates injectable factory with dependencies
const defineWithDeps = defineInjectableFactory
  .name('ComponentWithDeps')
  .inject<{ dep: Injectable<SomeType> }>()
  .handler(({ injector, appHooks: { onApplicationInitialized, onApplicationStart, onApplicationStop } }) => {
    // Implementation
  });
```

#### `defineServiceFactory`

Business logic and data access factory creator. Returns service factory functions that enforce `object | void` return types.

```typescript
// Creates a service factory function
const defineMyService = defineServiceFactory
  .name('MyService')
  .inject()
  .handler(() => ({
    doSomething: () => 'result',
  }));
```

#### `defineModuleFactory`

Feature grouping factory creator. Returns module factory functions that allow `Record<string | symbol, unknown> | void` return types.

```typescript
// Creates a module factory function
const defineMyModule = defineModuleFactory
  .name('MyModule')
  .inject()
  .handler(() => ({
    feature1: () => 'value1',
    feature2: () => 'value2',
  }));
```

#### `defineRouterFactory`

HTTP endpoint factory creator. Returns router factory functions with same constraints as modules.

```typescript
// Creates a router factory function
const defineMyRouter = defineRouterFactory
  .name('MyRouter')
  .inject()
  .handler(() => ({
    '/api/users': { GET: () => users },
  }));
```

#### `defineApp`

Application lifecycle orchestration with async hook management. Takes a module factory and creates the actual application instance with lifecycle control.

```typescript
// Create module factory
const defineAppModule = defineModuleFactory
  .name('AppModule')
  .inject()
  .handler(() => {
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

- **`onApplicationInitialized(callback, order?)`** - Fired during app creation, after user setup but before returning app instance
- **`onApplicationStart(callback, order?)`** - Register startup callback, fired when `app.start()` is called
- **`onApplicationStop(callback, order?)`** - Register shutdown callback, fired when `app.stop()` is called

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
├── index.ts                    # Main entry point with comprehensive JSDoc examples
├── define-app.ts               # Application lifecycle orchestration with async hooks
├── define-injectable-factory.ts # Core dependency injection foundation
├── define-service-factory.ts   # Business logic and data access layer
├── define-module-factory.ts    # Feature organization and grouping layer
├── define-router-factory.ts    # HTTP endpoint definitions and routing logic
├── define-app.test.ts          # Application lifecycle tests (16 tests)
├── define-injectable-factory.test.ts # Injectable factory tests (24 tests)
├── define-service-factory.test.ts    # Service factory tests (9 tests)
├── define-module-factory.test.ts     # Module factory tests (11 tests)
├── define-router-factory.test.ts     # Router factory tests (10 tests)
└── define-app-isolated.test.ts # Isolated application testing utilities

dist/                           # Built output (ES modules with TypeScript declarations)
├── *.js                       # Compiled JavaScript modules
├── *.d.ts                     # TypeScript declaration files
└── *.js.map                   # Source maps for debugging
```

## TypeScript Types

```typescript
// Core injectable types (all are injectables)
type Injectable<T = unknown> = T;
type Service<T = unknown> = Injectable<T>;
type Router<T = unknown> = Injectable<T>;

// Composition type
type Module<T = unknown> = Injectable<T>;

// Dependency injection schemas
type ComponentDependencies = Record<string, Injectable<unknown>>;
type ModuleDependencies = Record<string, Injectable<unknown>>;

// Handler function signatures
type ComponentHandler<S> = (params: {
  name: string; // Component name (literal type)
  injector?: () => ComponentDependencies; // Only present when dependencies exist
  appHooks: {
    onApplicationInitialized: (callback: () => unknown, order?: number) => void;
    onApplicationStart: (callback: () => unknown, order?: number) => void;
    onApplicationStop: (callback: () => unknown, order?: number) => void;
  };
}) => S;

type ModuleHandler<S> = (params: {
  name: string; // Module name (literal type)
  injector?: () => ModuleDependencies; // Only present when dependencies exist
  appHooks: {
    onApplicationInitialized: (callback: () => unknown, order?: number) => void;
    onApplicationStart: (callback: () => unknown, order?: number) => void;
    onApplicationStop: (callback: () => unknown, order?: number) => void;
  };
}) => S;
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
