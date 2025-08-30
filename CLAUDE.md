# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Requirements

**CRITICAL: When making ANY changes to the project (code, configuration, workflows, dependencies, etc.), ALWAYS update both CLAUDE.md and README.md to reflect the changes. This ensures documentation stays in sync with the entire project state.**

**REQUIRED: Always add JSDoc comments for all public methods and functions. Use clear descriptions and document parameters and return values.**

**REQUIRED: Ensure 100% test coverage for all code changes. Every new method, function, and code path must have corresponding tests. Use `npm run test:coverage` to verify coverage.**

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

This is a **layered dependency injection framework** with a strict hierarchy from bottom to top:

1. **Injectable** (`define-injectable.ts`) - Core DI factory creator foundation
2. **Service** (`define-service.ts`) - Business logic factory creator layer
3. **Module** (`define-module.ts`) - Feature grouping factory creator layer
4. **Router** (`define-router.ts`) - HTTP endpoint factory creator definitions
5. **App** (`define-app.ts`) - Application instance creation and lifecycle orchestration

### Key Architectural Concepts

**Factory Pattern:** `defineInjectableFactory`, `defineServiceFactory`, `defineModuleFactory`, and `defineRouterFactory` are **factory creator functions** that return factory functions. Only `defineApp` creates actual instances.

**Dependency Flow:** Factory creators can only depend on same-level or lower-level factories. All layers build on `defineInjectableFactory` as the foundation.

**Lifecycle Management:** The framework uses `@ultranomic/hook` for three-phase async lifecycle:

- `onApplicationInitialized` - Fires during app creation
- `onApplicationStart` - Fires when `app.start()` called
- `onApplicationStop` - Fires when `app.stop()` called

**Type Constraints:** Each factory creator enforces specific return types:

- Injectable: `object | void`
- Service: `object | void`
- Module: `Record<string | symbol, unknown> | void`
- Router: `Record<string | symbol, unknown> | void`

**Injection Pattern:** Factory creators use `.inject<Dependencies>().handler()` for dependency injection, where Dependencies is a Record type mapping string keys to Injectable factory types.

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
