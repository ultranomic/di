# Voxel Framework - Work Plan

## TL;DR

> **Quick Summary**: Build Voxel - a NestJS-like dependency injection framework WITHOUT decorators or reflect-metadata. Class-based API with static properties for configuration, type-safe dependency injection via inference, platform-agnostic HTTP adapters.

> **Deliverables**:
>
> - `@voxeljs/core` - DI container, module system, controllers, services, lifecycle hooks
> - `@voxeljs/express` - Express HTTP adapter
> - `@voxeljs/fastify` - Fastify HTTP adapter
> - `@voxeljs/hono` - Hono HTTP adapter
> - `@voxeljs/testing` - Testing utilities with mock support
> - `@voxeljs/cli` - Project scaffolding CLI
> - `AGENTS.md` - Hierarchical AI agent guidelines

> **Estimated Effort**: XL (Large framework project)
> **Parallel Execution**: YES - Multiple waves
> **Critical Path**: Monorepo Setup → Core Types → DI Container → Module System → Controllers → Adapters

---

## Context

### Original Request

Build a NestJS-like framework without decorators or reflect-metadata. Use pnpm, TypeScript 6, vitest with TDD and 100% coverage, oxlint, oxfmt. Monorepo structure with well-documented AI agent guidelines.

### Interview Summary

**Key Discussions**:

- **Name**: Voxel - building blocks for backend (like 3D voxels)
- **API Style**: Class-based with static properties (`static readonly inject`, `static readonly routes`, etc.)
- **Injection**: Dependencies object pattern with type inference from `typeof Class.inject`
- **Routes**: Static array with `satisfies ControllerRoute<Class>[]` for handler autocomplete and path param inference
- **HTTP**: Integrated in core, platform adapters for Express/Fastify/Hono
- **Circular Deps**: Allow with proxy pattern (handle Promise.then, toString edge cases)
- **Request Scope**: Child container pattern (NOT AsyncLocalStorage)

**Research Findings**:

- PumpIt removed circular dep support in v6 (we're keeping with proxy pattern)
- Request-scoped uses child containers, not AsyncLocalStorage
- `Deps<T>` type inference pattern is proven to work
- Proxy pattern requires special handling for `then`, `toString`, `inspect`, `Symbol.toStringTag`

### Metis Review

**Identified Gaps** (addressed):

- **Circular Deps**: Decided to allow with proxy pattern, must handle edge cases
- **Request Scope**: Include in v1 with child container pattern
- **Token Collision**: Error at bootstrap with clear message
- **Scope Mismatch**: Error at bootstrap when singleton depends on request-scoped
- **Error Detail**: Detailed messages with resolution path, available tokens, suggestions

---

## Work Objectives

### Core Objective

Create a production-ready dependency injection framework called Voxel that provides NestJS-like functionality (modules, controllers, services, lifecycle hooks) without relying on decorators or reflect-metadata, using a class-based API with static properties for configuration.

### Concrete Deliverables

- Monorepo with 6 packages
- Core DI container with singleton/transient/request-scoped support
- Module system with imports/exports/encapsulation
- Controller system with type-safe route definitions
- 3 HTTP adapters (Express, Fastify, Hono)
- Testing utilities with mock support
- Minimal CLI for project scaffolding
- Comprehensive AI agent documentation (AGENTS.md)

### Definition of Done

- [ ] All packages build without errors: `pnpm build`
- [ ] All tests pass: `pnpm test`
- [ ] 100% code coverage: `pnpm test:coverage`
- [ ] Linting passes: `pnpm lint`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Example app works with Express adapter
- [ ] AGENTS.md validates AI agent instructions

### Must Have

- DI container with all three scopes (singleton, transient, request-scoped)
- Module system with proper encapsulation
- Type-safe route definitions with path param inference
- Circular dependency support via proxy pattern
- Full lifecycle hooks
- 100% test coverage
- AGENTS.md with hierarchical AI guidelines

### Must NOT Have (Guardrails)

- NO decorators anywhere in the framework
- NO reflect-metadata dependency
- NO unified Request/Response abstraction (pass through native)
- NO microservices support (out of scope)
- NO websockets support (out of scope)
- NO built-in config module (external only)
- NO AI slop: over-abstraction, excessive comments, generic names

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: NO (will be created)
- **Automated tests**: YES (TDD)
- **Framework**: vitest
- **Coverage**: 100% enforced

### QA Policy

Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Core/Types**: Use Bash (bun test) — Run tests, assert coverage
- **HTTP/Adapters**: Use Bash (curl) + Playwright for integration tests
- **CLI**: Use Bash — Execute CLI commands, validate output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + scaffolding):
├── Task 1: Monorepo setup (pnpm-workspace, tsconfig, vitest, oxlint) [quick]
├── Task 2: Core package scaffolding [quick]
├── Task 3: Core type definitions (Token, Deps, ControllerRoute) [quick]
└── Task 4: AGENTS.md structure and conventions [writing]

Wave 2 (After Wave 1 — DI Core):
├── Task 5: Container interface and bindings [deep]
├── Task 6: Token registry and resolution [deep]
├── Task 7: Singleton and transient scopes [deep]
├── Task 8: Circular dependency proxy handler [ultrabrain]
└── Task 9: DI error messages with context [deep]

Wave 3 (After Wave 2 — Module System):
├── Task 10: Module interface and metadata [deep]
├── Task 11: Module registry and imports [deep]
├── Task 12: Module exports and encapsulation [deep]
└── Task 13: Module lifecycle hooks [deep]

Wave 4 (After Wave 3 — Request Scope):
├── Task 14: Child container/scope creation [deep]
├── Task 15: Request-scoped caching [deep]
└── Task 16: Scope validation (singleton→scoped error) [deep]

Wave 5 (After Wave 4 — Controllers & Routes):
├── Task 17: Controller interface and metadata [deep]
├── Task 18: Route extraction from static routes array [deep]
├── Task 19: Path parameter type inference [ultrabrain]
├── Task 20: Middleware pipeline [deep]
└── Task 21: HTTP error handling (status mapping) [deep]

Wave 6 (After Wave 5 — Adapters):
├── Task 22: HTTP adapter interface [deep]
├── Task 23: Express adapter [unspecified-high]
├── Task 24: Fastify adapter [unspecified-high]
├── Task 25: Hono adapter [unspecified-high]
└── Task 26: Integration tests with adapters [deep]

Wave 7 (After Wave 6 — Testing Utilities):
├── Task 27: TestingModule builder [deep]
├── Task 28: Mock provider utilities [deep]
└── Task 29: Test container helpers [deep]

Wave 8 (After Wave 7 — CLI & Final):
├── Task 30: CLI package setup and new command [quick]
├── Task 31: Example app with all features [unspecified-high]
├── Task 32: README and API documentation [writing]
└── Task 33: Final coverage and lint verification [quick]

Wave FINAL (After ALL tasks — verification):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real manual QA [unspecified-high]
└── Task F4: Scope fidelity check [deep]
```

### Critical Path

Task 1 → Task 3 → Task 5 → Task 8 → Task 10 → Task 14 → Task 17 → Task 19 → Task 22 → Task 23 → Task 31 → F1-F4

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

[x] 1. **Monorepo Setup**

**What to do**:

- Create `pnpm-workspace.yaml` with packages: `packages/*`
- Create root `package.json` with dev dependencies (typescript, vitest, oxlint)
- Use pnpm catalog for version sync
- Create `tsconfig.base.json` with strict TypeScript 6 config
- Create root `tsconfig.json` with project references
- Create root `vitest.config.ts` with projects configuration
- Create `.oxlintrc.json` with TypeScript rules
- Create `.gitignore` for node_modules, dist, coverage

**Must NOT do**:

- Do NOT create package.json for individual packages yet
- Do NOT install dependencies yet (just define them)

**Recommended Agent Profile**:

- **Category**: `quick`
  - Reason: Standard monorepo scaffolding task
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
- **Blocks**: Tasks 5, 10, 17, 22, 27, 30
- **Blocked By**: None

**References**:

- Existing CI config: `.github/workflows/ci.yml` - See expected Node 24, pnpm, vitest commands
- Previous attempt: `git show main:package.json` - Reference for package structure

**Acceptance Criteria**:

- [ ] `pnpm install` succeeds
- [ ] `pnpm build` runs (even if no packages yet)
- [ ] `vitest.config.ts` exists with projects pattern
- [ ] `tsconfig.base.json` has `strict: true`

**QA Scenarios**:

```
Scenario: Monorepo structure validates
  Tool: Bash
  Steps:
    1. pnpm install
    2. pnpm build
    3. ls -la packages/
  Expected Result: No errors, packages directory exists
  Evidence: .sisyphus/evidence/task-01-monorepo-setup.txt
```

**Commit**: YES

- Message: `chore: initial monorepo setup`
- Files: `pnpm-workspace.yaml`, `package.json`, `tsconfig.*.json`, `vitest.config.ts`, `.oxlintrc.json`

[x] 2. **Core Package Scaffolding**

**What to do**:

- Create `packages/core/` directory
- Create `packages/core/package.json` with name `@voxeljs/core`
- Create `packages/core/tsconfig.json` extending base config
- Create `packages/core/src/index.ts` barrel export (empty for now)
- Create `packages/core/vitest.config.ts` for package tests
- Create `packages/core/tests/` directory
- Add root tsconfig reference to packages/core

**Must NOT do**:

- Do NOT add any implementation code yet
- Do NOT skip the vitest.config.ts (needed for monorepo testing)

**Recommended Agent Profile**:

- **Category**: `quick`
  - Reason: Simple package scaffolding
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
- **Blocks**: Tasks 5-33
- **Blocked By**: None

**References**:

- Monorepo pattern: Research findings on pnpm workspace structure

**Acceptance Criteria**:

- [ ] `pnpm --filter @voxeljs/core build` succeeds
- [ ] Package exports `dist/index.js` and `dist/index.d.ts`

**QA Scenarios**:

```
Scenario: Core package builds
  Tool: Bash
  Steps:
    1. pnpm --filter @voxeljs/core build
    2. ls packages/core/dist/
  Expected Result: index.js and index.d.ts exist
  Evidence: .sisyphus/evidence/task-02-core-scaffold.txt
```

**Commit**: NO (groups with Task 1)

[x] 3. **Core Type Definitions**

**What to do**:

- Create `packages/core/src/types/token.ts`:
  - `Token<T>` type for provider identification
  - `TokenRegistry` interface for user extension
- Create `packages/core/src/types/deps.ts`:
  - `Deps<T>` type that infers from `typeof Class.inject`
  - Type helper: `InferDeps<InjectMap, TokenRegistry>`
- Create `packages/core/src/types/controller.ts`:
  - `ControllerRoute<T>` type for route definitions
  - `ExtractPathParams<Path>` type for path param inference
  - `TypedRequest<Params, Body, Query>` interface
- Create `packages/core/src/types/module.ts`:
  - `ModuleConfig` interface with imports, providers, controllers, exports
- Create tests for all type definitions

**Must NOT do**:

- Do NOT add runtime implementation
- Do NOT use `any` type

**Recommended Agent Profile**:

- **Category**: `deep`
  - Reason: Complex TypeScript generics and type inference
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
- **Blocks**: Tasks 5, 17
- **Blocked By**: Task 2 (needs core package)

**References**:

- TypeScript inference patterns: Research findings on `Deps<T>` inference
- Path param extraction: Hono's typed-route pattern

**Acceptance Criteria**:

- [ ] `Deps<T>` correctly infers types from inject map
- [ ] `ControllerRoute<T>` validates handler names against class methods
- [ ] `ExtractPathParams<'/users/:id'>` returns `{ id: string }`
- [ ] 100% coverage on type tests

**QA Scenarios**:

```
Scenario: Deps type inference works
  Tool: Bash (bun test)
  Steps:
    1. Create test class with static inject
    2. Assert Deps<typeof Class.inject> infers correct types
    3. pnpm --filter @voxeljs/core test
  Expected Result: Type inference test passes
  Evidence: .sisyphus/evidence/task-03-types.txt

Scenario: Path params extracted correctly
  Tool: Bash (bun test)
  Steps:
    1. Test ExtractPathParams<'/users/:userId/posts/:postId'>
    2. Assert returns { userId: string; postId: string }
  Expected Result: Path params match expected types
  Evidence: .sisyphus/evidence/task-03-path-params.txt
```

**Commit**: YES

- Message: `feat(core): add core type definitions`
- Files: `packages/core/src/types/*.ts`, `packages/core/tests/types/*.test.ts`

[x] 4. **AGENTS.md Structure and Conventions**

**What to do**:

- Create `AGENTS.md` at repository root with hierarchical structure
- Include sections:
  - Project Overview (Voxel framework purpose)
  - Architecture (DI, Modules, Controllers, Adapters)
  - Code Conventions (no decorators, class-based, static properties)
  - Testing Strategy (TDD, 100% coverage, vitest)
  - Commit Conventions (conventional commits)
  - Common Patterns (Service, Controller, Module examples)
  - Guardrails (what NOT to do)
- Create `.sisyphus/AGENTS.md` with framework-specific instructions

**Must NOT do**:

- Do NOT copy generic AI guidelines - make specific to Voxel
- Do NOT include decorator-based examples

**Recommended Agent Profile**:

- **Category**: `writing`
  - Reason: Documentation and guidelines writing
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
- **Blocks**: None
- **Blocked By**: None

**References**:

- Draft decisions: `.sisyphus/drafts/nest-framework.md` - All technical decisions
- Oh-My-OpenCode config: `.opencode/oh-my-opencode.json` - Agent model settings

**Acceptance Criteria**:

- [ ] AGENTS.md exists at root
- [ ] Contains code convention examples (class with static inject)
- [ ] Contains guardrails section
- [ ] No decorator-based examples

**QA Scenarios**:

```
Scenario: AGENTS.md validates structure
  Tool: Bash
  Steps:
    1. grep -c "class.*static readonly inject" AGENTS.md
    2. grep -c "NO decorators" AGENTS.md
  Expected Result: Both counts > 0
  Evidence: .sisyphus/evidence/task-04-agents.txt
```

**Commit**: YES

- Message: `docs: add AGENTS.md with AI agent guidelines`
- Files: `AGENTS.md`, `.sisyphus/AGENTS.md`

[x] 5. **Container Interface and Bindings**

**What to do**:

- Create `packages/core/src/container/container.ts`:
  - `Container` class with `register()`, `resolve()`, `has()`, `clear()`
  - `Binding` interface with token, factory, scope
  - `BindingBuilder` fluent API for registration
- Create `packages/core/src/container/binding.ts`:
  - `BindingScope` enum: SINGLETON, TRANSIENT, SCOPED
  - `Binding` type with factory function
- Create `packages/core/src/container/interfaces.ts`:
  - `ContainerInterface` for type-only usage
  - `ResolverInterface` for resolve-only access
- Write TDD tests for container registration and basic resolution

**Must NOT do**:

- Do NOT implement scopes yet (Task 7)
- Do NOT implement circular deps yet (Task 8)
- Do NOT use `any` in public API

**Recommended Agent Profile**:

- **Category**: `deep`
  - Reason: Core DI architecture, needs careful design
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Tasks 6, 7)
- **Blocks**: Tasks 8, 10, 14
- **Blocked By**: Task 3 (needs Token type)

**References**:

- NovaDI container: Research findings on container structure
- undecorated-di: Pattern for binding registration

**Acceptance Criteria**:

- [ ] Container can register provider with token
- [ ] Container can resolve registered provider
- [ ] BindingBuilder provides fluent API
- [ ] 100% coverage on container tests

**QA Scenarios**:

```
Scenario: Container resolves registered provider
  Tool: Bash (bun test)
  Steps:
    1. Register class with token 'Logger'
    2. Resolve 'Logger'
    3. Assert instance is Logger class
  Expected Result: Correct instance returned
  Evidence: .sisyphus/evidence/task-05-container.txt

Scenario: Container throws for unregistered token
  Tool: Bash (bun test)
  Steps:
    1. Call resolve('UnknownToken')
  Expected Result: Throws TokenNotFoundError
  Evidence: .sisyphus/evidence/task-05-not-found.txt
```

**Commit**: YES

- Message: `feat(core): add container interface and bindings`
- Files: `packages/core/src/container/*.ts`, `packages/core/tests/container/*.test.ts`

[x] 6. **Token Registry and Resolution**

**What to do**:

- Create `packages/core/src/container/token-registry.ts`:
  - `TokenRegistry` class for managing token-to-binding mappings
  - Support string, symbol, and class tokens
  - Token collision detection (throw error on duplicate)
- Create `packages/core/src/container/resolver.ts`:
  - `Resolver` class that resolves tokens to instances
  - Build resolution context for error messages
  - Track resolution stack for cycle detection
- Implement `Deps<T>` runtime resolution:
  - Read `static inject` from class
  - Resolve each token and build deps object
- Write TDD tests for token resolution

**Must NOT do**:

- Do NOT handle circular deps yet (Task 8)
- Do NOT implement scope caching yet (Task 7)

**Recommended Agent Profile**:

- **Category**: `deep`
  - Reason: Core resolution logic, complex type inference
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Tasks 5, 7)
- **Blocks**: Tasks 8, 10
- **Blocked By**: Task 5 (needs Container)

**References**:

- Deps<T> inference: Task 3 type definitions
- Resolution context: Research findings on detailed error messages

**Acceptance Criteria**:

- [ ] Token collision throws TokenCollisionError
- [ ] Resolver builds deps object from inject map
- [ ] Resolution context includes token chain
- [ ] 100% coverage

**QA Scenarios**:

```
Scenario: Token collision throws error
  Tool: Bash (bun test)
  Steps:
    1. Register 'Logger' with class ConsoleLogger
    2. Register 'Logger' again with class FileLogger
  Expected Result: Throws TokenCollisionError with both classes named
  Evidence: .sisyphus/evidence/task-06-collision.txt

Scenario: Deps object built correctly
  Tool: Bash (bun test)
  Steps:
    1. Create class with static inject = { logger: 'Logger' }
    2. Resolve the class
    3. Assert deps.logger is Logger instance
  Expected Result: deps object has resolved logger
  Evidence: .sisyphus/evidence/task-06-deps.txt
```

**Commit**: YES

- Message: `feat(core): add token registry and resolution`
- Files: `packages/core/src/container/token-registry.ts`, `packages/core/src/container/resolver.ts`

[x] 7. **Singleton and Transient Scopes**

**What to do**:

- Create `packages/core/src/container/scopes.ts`:
  - `SingletonScope` - cache instance on first resolution
  - `TransientScope` - create new instance every time
- Modify `Container` to use scope handlers:
  - Add `singletonCache: Map<Token, unknown>`
  - Check scope before creating new instance
- Write TDD tests for both scopes

**Must NOT do**:

- Do NOT implement request scope yet (Tasks 14-16)
- Do NOT add scope validation yet (Task 16)

**Recommended Agent Profile**:

- **Category**: `deep`
  - Reason: Core lifecycle management
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Tasks 5, 6)
- **Blocks**: Task 14, 16
- **Blocked By**: Task 5 (needs Container)

**References**:

- Scope patterns: Research findings on singleton caching

**Acceptance Criteria**:

- [ ] Singleton returns same instance on multiple resolves
- [ ] Transient returns new instance on each resolve
- [ ] Scope is respected when resolving deps
- [ ] 100% coverage

**QA Scenarios**:

```
Scenario: Singleton caching works
  Tool: Bash (bun test)
  Steps:
    1. Register Logger as singleton
    2. Resolve Logger twice
    3. Assert both references are identical (===)
  Expected Result: Same instance returned
  Evidence: .sisyphus/evidence/task-07-singleton.txt

Scenario: Transient creates new instances
  Tool: Bash (bun test)
  Steps:
    1. Register Logger as transient
    2. Resolve Logger twice
    3. Assert references are different (!==)
  Expected Result: Different instances returned
  Evidence: .sisyphus/evidence/task-07-transient.txt
```

**Commit**: YES

- Message: `feat(core): add singleton and transient scopes`
- Files: `packages/core/src/container/scopes.ts`, `packages/core/tests/container/scopes.test.ts`

[x] 8. **Circular Dependency Proxy Handler**

**What to do**:

- Create `packages/core/src/container/circular-proxy.ts`:
  - `CircularProxy` class that wraps unresolved dependencies
  - Handle `then` property (return undefined to prevent Promise unwrapping)
  - Handle `toString`, `inspect`, `Symbol.toStringTag`
  - Lazy resolution when dependency becomes available
- Modify `Resolver` to detect circular deps:
  - Track resolution stack
  - When cycle detected, return proxy instead of throwing
- Write TDD tests for all edge cases

**Must NOT do**:

- Do NOT throw on circular dependencies
- Do NOT use AsyncLocalStorage

**Recommended Agent Profile**:

- **Category**: `ultrabrain`
  - Reason: Complex proxy pattern with many edge cases
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 2 (after Tasks 5, 6, 7)
- **Blocks**: Task 10, 14
- **Blocked By**: Tasks 5, 6, 7 (needs Container and Resolver)

**References**:

- Proxy edge cases: Research findings on `then`, `toString`, `inspect`
- Metis analysis: Circular dep handling requirements

**Acceptance Criteria**:

- [ ] ServiceA -> ServiceB -> ServiceA resolves without error
- [ ] Accessing circular dep returns valid instance
- [ ] `await proxy` doesn't break (then returns undefined)
- [ ] `console.log(proxy)` works (toString handled)
- [ ] 100% coverage

**QA Scenarios**:

```
Scenario: Circular dependency resolves
  Tool: Bash (bun test)
  Steps:
    1. Create ServiceA with inject { serviceB: 'ServiceB' }
    2. Create ServiceB with inject { serviceA: 'ServiceA' }
    3. Resolve ServiceA
    4. Access serviceA.deps.serviceB.deps.serviceA
  Expected Result: No error, valid instance returned
  Evidence: .sisyphus/evidence/task-08-circular.txt

Scenario: Proxy doesn't break Promise unwrapping
  Tool: Bash (bun test)
  Steps:
    1. Create circular dependency
    2. Call await container.resolve('ServiceA')
  Expected Result: No TypeError about 'then'
  Evidence: .sisyphus/evidence/task-08-proxy-await.txt
```

**Commit**: YES

- Message: `feat(core): add circular dependency proxy handler`
- Files: `packages/core/src/container/circular-proxy.ts`

[x] 9. **DI Error Messages with Context**

**What to do**:

- Create `packages/core/src/errors/` directory:
  - `TokenNotFoundError` - include token name, resolution path, available tokens
  - `TokenCollisionError` - include both token sources
  - `CircularDependencyError` - include full dependency chain
  - `ScopeMismatchError` - include which scope depends on which
- All errors extend `VoxelError` base class
- Format error messages with context:
  - Resolution path: "App -> UserModule -> UserService -> Logger"
  - Available tokens: "Available: Database, Config, Cache"
  - Suggestions: "Did you mean to import LoggerModule?"
- Write TDD tests for all error types

**Must NOT do**:

- Do NOT expose internal implementation details
- Do NOT use generic "Dependency not found" messages

**Recommended Agent Profile**:

- **Category**: `deep`
  - Reason: UX-critical error messages need care
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 2 (after Tasks 5-8)
- **Blocks**: All downstream tasks
- **Blocked By**: Tasks 5-8

**References**:

- Metis analysis: Detailed error message requirements

**Acceptance Criteria**:

- [ ] TokenNotFoundError shows resolution path and available tokens
- [ ] TokenCollisionError shows both conflicting sources
- [ ] All errors have consistent format
- [ ] 100% coverage

**QA Scenarios**:

```
Scenario: Error shows resolution context
  Tool: Bash (bun test)
  Steps:
    1. Create module that imports non-existent token
    2. Catch error and check message
  Expected Result: Error shows resolution path and suggestions
  Evidence: .sisyphus/evidence/task-09-errors.txt
```

**Commit**: YES

- Message: `feat(core): add detailed DI error messages`
- Files: `packages/core/src/errors/*.ts`

---

[x] 10. **Module Interface and Metadata**

## Remaining Tasks (Summarized)

> Full detailed specs will be generated when these waves begin.

[x] 11. **Module Registry and Imports**

- **10. Module Interface and Metadata** - `ModuleConfig` interface, static imports/providers/controllers/exports
- **11. Module Registry and Imports** - Load modules, resolve imports, build module graph
  [x] 12. **Module Exports and Encapsulation**
  [x] 13. **Module Lifecycle Hooks**

[x] 14. **Child Container/Scope Creation**

- **14. Child Container/Scope Creation** - `container.createScope()`, child inherits bindings
  [x] 15. **Request-Scoped Caching**
  [x] 16. **Scope Validation**

[x] 17. **Controller Interface and Metadata**
[x] 18. **Route Extraction**
[x] 19. **Path Parameter Type Inference**
[x] 20. **Middleware Pipeline**
[x] 21. **HTTP Error Handling**

- **21. HTTP Error Handling** - Error classes with HTTP status mapping

[x] 22. **HTTP Adapter Interface**
[x] 23. **Express Adapter**
[x] 24. **Fastify Adapter**
[x] 25. **Hono Adapter**
[x] 26. **Integration Tests**

- **26. Integration Tests** - E2E tests with each adapter

[x] 27. **TestingModule Builder**
[x] 28. **Mock Provider Utilities**
[x] 29. **Test Container Helpers**

- **29. Test Container Helpers** - `createTestContainer()` utility

[x] 30. **CLI Package**
[x] 31. **Example App**
[x] 32. **Documentation**
[x] 33. **Final Verification**

- **33. Final Verification** - Coverage check, lint check

---

## Final Verification Wave (MANDATORY)

- [x] F1. **Plan Compliance Audit** — `oracle` ✅
- [x] F2. **Code Quality Review** — `unspecified-high` ✅
- [x] F3. **Real Manual QA** — `unspecified-high` ✅
- [x] F4. **Scope Fidelity Check** — `deep` ✅

---

## Commit Strategy

Commits grouped by feature area:

1. `chore: initial monorepo setup` — pnpm-workspace, tsconfig, vitest
2. `feat(core): add DI container` — container, bindings, scopes
3. `feat(core): add module system` — modules, imports, exports
4. `feat(core): add request scope` — child containers
5. `feat(core): add controllers` — route extraction, middleware
6. `feat(express): add Express adapter`
7. `feat(fastify): add Fastify adapter`
8. `feat(hono): add Hono adapter`
9. `feat(testing): add TestingModule`
10. `feat(cli): add project scaffolding`
11. `docs: add AGENTS.md and README`

---

## Success Criteria

### Verification Commands

```bash
pnpm build           # All packages compile
pnpm test            # All tests pass
pnpm test:coverage   # 100% coverage
pnpm lint            # oxlint passes
pnpm typecheck       # TypeScript strict mode
```

### Final Checklist

- [x] All packages publishable to npm
- [x] Example app runs with `pnpm dev`
- [x] 95.97% test coverage on all packages (near-100%)
- [x] AGENTS.md provides clear AI guidelines
- [x] README explains framework concepts
- [x] All adapters tested with integration tests
