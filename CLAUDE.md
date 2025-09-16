# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Requirements

**CRITICAL: When making ANY changes to the project (code, configuration, workflows, dependencies, etc.), ALWAYS update both CLAUDE.md and README.md to reflect the changes. This ensures documentation stays in sync with the entire project state.**

**REQUIRED: Always add JSDoc comments for all public methods and functions. Use clear descriptions and document parameters and return values.**

**REQUIRED: Ensure 100% test coverage for all code changes. Every new method, function, and code path must have corresponding tests. Use `npm run test:coverage` to verify coverage.**

## Current API Pattern

**ALL FACTORY CREATORS USE THE MANDATORY FLUENT API PATTERN:**

### Injectable Layer (Injectable, Service, Router)

```typescript
// Without dependencies
defineXFactory
  .name('InjectableName')
  .inject()
  .handler(({ name, appHooks }) => ({
    /* implementation */
  }));

// With dependencies
defineXFactory
  .name('InjectableName')
  .inject<Dependencies>()
  .handler(({ name, injector, appHooks }) => {
    const deps = injector();
    return {
      /* implementation */
    };
  });
```

### Module Layer

```typescript
// Without dependencies
defineModuleFactory
  .name('ModuleName')
  .inject()
  .handler(({ name, appHooks }) => ({
    /* composition */
  }));

// With dependencies (injectables and other modules)
defineModuleFactory
  .name('ModuleName')
  .inject<Dependencies>()
  .handler(({ name, injector, appHooks }) => {
    const deps = injector();
    return {
      /* composition */
    };
  });
```

**Handler functions receive a single object parameter with `{ name, injector?, appHooks }`**

- `name`: The injectable/module name (literal string type)
- `injector`: Function returning dependencies with automatic logger injection (always present)
- `appHooks`: Lifecycle hooks object with `onApplicationInitialized`, `onApplicationStart`, `onApplicationStop`

## Logger Injection System

**AUTOMATIC LOGGER INJECTION: All factory creators automatically inject a component-specific logger derived from the app logger:**

### Logger Setup with defineApp

```typescript
import pino from 'pino';

// With logger
const app = await defineApp(() => myModule(), {
  logger: pino(), // Pass pino logger instance
});

// Without logger (logger will be undefined)
const app = await defineApp(() => myModule());
```

### Accessing Logger in Components

```typescript
// Injectable/Service/Router/Module with automatic logger injection
defineServiceFactory
  .name('UserService')
  .inject()
  .handler(({ name, injector }) => {
    const { logger } = injector();
    logger?.info('Service initializing'); // Logs with [UserService] prefix

    return {
      createUser: (data) => {
        logger?.info('Creating user', data);
        // business logic
      },
    };
  });

// With dependencies - logger is automatically included
defineServiceFactory
  .name('PaymentService')
  .inject<{ userService: Service<UserServiceType> }>()
  .handler(({ name, injector }) => {
    const { logger, userService } = injector();
    logger?.info('Payment service starting');
    // implementation
  });
```

## Core Commands

**Building & Development:**

```bash
npm run build           # Compile TypeScript using tsgo
npm run typecheck       # Type check without emitting files
npm run clean           # Remove dist/ directory
npm run prepublishOnly  # Full validation before publishing
```

**Testing:**

```bash
npm test                        # Run all tests with Node.js native runner
npm run test:coverage          # Run tests with coverage report
node --test src/[file].test.ts # Run single test file
```

**Code Quality:**

```bash
npm run format          # Format code with Prettier
pnpm install           # Install dependencies (required package manager)
```

## Architecture Overview

This is a **layered dependency injection framework** with a clear separation between injectables, composition, and orchestration:

```
┌─────────────────┐
│   Application   │  ← defineApp (orchestrates all modules)
├─────────────────┤
│     Module      │  ← defineModuleFactory (composes injectables)
├─────────────────┤
│   Injectable    │  ← defineInjectableFactory, defineServiceFactory, defineRouterFactory
│                 │    (individual injectables that can be injected)
└─────────────────┘
```

### Layer Responsibilities

1. **Injectable Layer** - Individual building blocks:
   - **Injectable** (`define-injectable-factory.ts`) - Core dependency injection foundation
   - **Service** (`define-service-factory.ts`) - Business logic and data access
   - **Router** (`define-router-factory.ts`) - HTTP endpoint definitions

2. **Module Layer** - Feature composition:
   - **Module** (`define-module-factory.ts`) - Groups related injectables into features

3. **Application Layer** - Lifecycle orchestration:
   - **App** (`define-app.ts`) - Manages application lifecycle and coordinates modules

### Key Architectural Concepts

**Factory Pattern:** Injectable factories (`defineInjectableFactory`, `defineServiceFactory`, `defineRouterFactory`) and module factory (`defineModuleFactory`) return factory functions. Only `defineApp` creates actual instances.

**Mandatory Naming:** All factory creators require explicit naming via `.name('InjectableName')` or `.name('ModuleName')` as the first step for better debugging and identification.

**Dependency Flow:** Injectables can depend on other injectables. Modules compose injectables and can depend on other modules. The application orchestrates all modules.

**Lifecycle Management:** The framework uses `@ultranomic/hook` for three-phase async lifecycle:

- `onApplicationInitialized` - Fires during app creation
- `onApplicationStart` - Fires when `app.start()` called
- `onApplicationStop` - Fires when `app.stop()` called

**Type Constraints:** Each layer enforces specific return types:

**Injectable Layer:**

- Injectable: `object | void`
- Service: `object | void`
- Router: `Record<string | symbol, unknown> | void`

**Module Layer:**

- Module: `Record<string | symbol, unknown> | void` (composes injectables)

**Application Layer:**

- App: Returns application instance with `start()` and `stop()` methods

**Injection Pattern:** All factory creators use the mandatory fluent API pattern:

**Injectable Layer:**

- `.name('InjectableName').inject().handler(({ name, appHooks }) => ...)` for no dependencies
- `.name('InjectableName').inject<Dependencies>().handler(({ name, injector, appHooks }) => ...)` for dependencies

**Module Layer:**

- `.name('ModuleName').inject().handler(({ name, appHooks }) => ...)` for no dependencies
- `.name('ModuleName').inject<Dependencies>().handler(({ name, injector, appHooks }) => ...)` for dependencies

**Dependencies Types:**

- Injectable dependencies: `Record<string, Injectable<unknown>>`
- Module dependencies: Can include other injectables and modules: `Record<string, Injectable<unknown>>`

## Build System

- **Compiler:** `tsgo` (modern TypeScript toolchain)
- **Module System:** ES modules with `.ts` extension rewriting
- **Output:** `dist/` contains compiled JS, declaration files, and source maps
- **Config:** `tsconfig.json` excludes test files from compilation but includes them in type checking

## Testing Strategy

Uses **Node.js native test runner** (no external framework). Test files follow pattern `*.test.ts` with nested `describe`/`it` structure. The `define-app-isolated.test.ts` provides utilities for testing applications in isolation without shared global state.

## Important Notes

- **Global State:** Application hooks are global via `appHooks` instance - be careful with test isolation
- **ES Modules:** All files use `.ts` extensions in imports due to `rewriteRelativeImportExtensions: true`
- **Strict TypeScript:** Very strict tsconfig with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.
