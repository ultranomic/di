# Class-Only Registration Design

## Summary

Simplify the DI container API by removing factory-based registration and requiring class-only tokens with explicit `static inject` declarations.

## Motivation

The current factory-based API is verbose and error-prone:

```typescript
container.register(UserService, (c) => new UserService(...c.buildDeps(UserService.inject))).asSingleton();
```

Since all injectable classes already declare dependencies via `static inject`, the container can automatically instantiate them.

## API Changes

### Registration Signature

**Before:**
```typescript
register<T>(token: Token<T>, factory: (container: ResolverInterface) => T): BindingBuilder<T>
```

**After:**
```typescript
register<T extends Injectable>(token: T, options?: RegisterOptions): void
```

### New Types

```typescript
type Scope = 'singleton' | 'transient' | 'scoped';

interface RegisterOptions {
  scope?: Scope; // default: 'singleton'
}

// Injectable classes must have static inject
interface Injectable {
  new (...args: unknown[]) => unknown;
  inject: readonly Token[];
}
```

### Usage Examples

```typescript
// All injectable classes must declare inject (even if empty)
class Logger {
  static readonly inject = [] as const satisfies DepsTokens<Logger>;
}

class UserService {
  static readonly inject = [Logger] as const satisfies DepsTokens<UserService>;
  constructor(private logger: Logger) {}
}

// Registration - singleton by default
container.register(Logger);
container.register(UserService);

// Explicit scope
container.register(Validator, { scope: 'transient' });
container.register(RequestContext, { scope: 'scoped' });
```

## Breaking Changes

1. **Factory parameter removed** - `register(token, factory)` becomes `register(token, options?)`
2. **Fluent builder removed** - No more `.asSingleton()`, `.asTransient()`, `.asScoped()`
3. **`static inject` required** - Classes without `inject` will fail at registration
4. **Default scope changed** - Transient → Singleton

## Files to Modify

| File | Change |
|------|--------|
| `src/core/container/container.ts` | Simplify `register()`, auto-instantiate |
| `src/core/container/interfaces.ts` | Update `ContainerInterface` |
| `src/core/container/binding.ts` | Remove `BindingBuilder`, add `Scope` type |
| `src/core/module/module.ts` | Update auto-registration |
| `src/core/module/module-container.ts` | Update wrapper registration |
| `src/testing/mock.ts` | Update mock registration |
| Tests | Update all registration calls |
| README.md | Update documentation |

## Implementation Notes

- Container uses `container.buildDeps(Class.inject)` to resolve dependencies
- Classes without `static inject` throw clear error at registration time
- Scope validation (singleton depending on scoped) remains unchanged
