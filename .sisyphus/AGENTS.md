# Sisyphus AGENTS.md - Voxel Framework Task Instructions

## Overview

This document provides task execution patterns specific to the Voxel framework when working within the Sisyphus workflow system.

## Task Execution Patterns

### Code Implementation Tasks

When implementing new features:

1. **Read the plan first** - Check `.sisyphus/plans/voxel-framework.md` for the task specification
2. **Follow TDD** - Write the test before implementation
3. **Use static properties** - Never decorators
4. **Maintain 100% coverage** - All code paths must be tested

### Before Writing Code

```bash
# Check for TypeScript errors
pnpm typecheck

# Run tests for the package
pnpm --filter @voxeljs/core test

# Check lint
pnpm lint
```

### After Writing Code

```bash
# Verify build
pnpm build

# Run all tests
pnpm test

# Check coverage
pnpm test:coverage
```

## Evidence File Conventions

Save QA evidence to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`

Examples:
- `.sisyphus/evidence/task-05-container.txt`
- `.sisyphus/evidence/task-08-circular.txt`

### Evidence Format

```text
Scenario: Container resolves registered provider
Steps:
  1. Register class with token 'Logger'
  2. Resolve 'Logger'
  3. Assert instance is Logger class

Result: PASS
Output:
  > pnpm --filter @voxeljs/core test
  > ...
  > ✓ container.test.ts (5 tests) 15ms
```

## Notepad Conventions

Record findings in `.sisyphus/notepads/voxel-framework/`:

### learnings.md

Document patterns and successful approaches:

```markdown
## 2024-02-22: Deps Type Inference

The `typeof Class.inject` pattern works well for inferring dependency types:

class Service {
  static readonly inject = { db: 'Database' } as const
  constructor(private deps: typeof Service.inject) {}
}

This gives `deps.db` proper typing.
```

### issues.md

Document problems and blockers:

```markdown
## 2024-02-22: Circular Proxy Edge Case

The proxy needs to handle `then` property to prevent Promise unwrapping.
Return `undefined` from proxy getter for `then`.
```

### decisions.md

Document architectural choices:

```markdown
## 2024-02-22: Request Scope via Child Containers

Decision: Use child container pattern instead of AsyncLocalStorage.
Rationale: Cleaner lifecycle management, explicit scope boundaries.
```

## Verification Checklist

Before marking a task complete:

- [ ] All tests pass: `pnpm test`
- [ ] Coverage is 100%: `pnpm test:coverage`
- [ ] Lint passes: `pnpm lint`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Evidence saved to `.sisyphus/evidence/`
- [ ] Learnings appended to notepad

## Common Commands

```bash
# Build all packages
pnpm build

# Test specific package
pnpm --filter @voxeljs/core test

# Run with coverage
pnpm --filter @voxeljs/core test:coverage

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
```

## Package-Specific Notes

### @voxeljs/core

Core DI functionality. Changes here affect all other packages.

Key files:
- `src/container/container.ts` - Main container class
- `src/container/resolver.ts` - Dependency resolution
- `src/container/circular-proxy.ts` - Circular dependency handling
- `src/module/module-registry.ts` - Module loading
- `src/controller/route-extractor.ts` - Route parsing

### @voxeljs/express, @voxeljs/fastify, @voxeljs/hono

HTTP adapters. Each adapter must implement the same interface.

Pattern:
```typescript
interface HttpAdapter {
  registerController(controller: ControllerClass): void
  listen(port: number): Promise<void>
  close(): Promise<void>
}
```

### @voxeljs/testing

Testing utilities. Must work with all adapters.

Key exports:
- `Test.createModule()` - Fluent module builder
- `mock(token).use(implementation)` - Mock replacement

### @voxeljs/cli

Project scaffolding. Keep minimal.

Commands:
- `voxel new <name>` - Create new project

## Error Message Guidelines

All errors must include:

1. **What went wrong** - Clear description
2. **Where it happened** - Resolution path or location
3. **What's available** - List of valid tokens/options
4. **Suggestion** - How to fix it

Example:
```
TokenNotFoundError: Token 'Logger' not found in UserService
  Resolution path: App -> UserModule -> UserService
  Available tokens: Database, Config, Cache
  Suggestion: Import LoggerModule in UserModule
```
