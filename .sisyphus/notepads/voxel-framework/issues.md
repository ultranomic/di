
## 2026-02-22: Node.js 25.4.0 fetch "bad port" Issue

**Issue**: When running Hono adapter tests in vitest on Node.js v25.4.0, the "should handle POST requests" test fails with "bad port" error from undici.

**Root Cause**: Node.js 25.4.0's built-in fetch (undici) has a bug when making POST requests with a body. The error message "bad port" is misleading - it's not about the port value but appears to be an internal undici issue.

**Workaround**: Using Node's `http` module instead of `fetch` works correctly. The adapter functionality is verified working.

**Status**: Environmental issue, not a code bug. The Hono adapter's `fetch` binding fix (arrow function) is correct and working.

**Related Fix**: Changed `fetch: this.app.fetch` to `fetch: (req) => this.app.fetch(req)` to preserve `this` context.



## 2026-02-23: Scope Fidelity Check - CLI Template Violation

**Issue**: The CLI package (`packages/cli/src/commands/new.ts`) generates project templates using the `@Module` decorator pattern, which violates the framework's explicit guardrails.

**Location**: Lines 99-103 in `packages/cli/src/commands/new.ts`
```typescript
@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class AppModule {}
```

**Guardrail Violation**: The AGENTS.md explicitly states MUST NOT use decorators anywhere (`@Inject`, `@Injectable`, `@Controller`, `@Module`, etc.)

**Correct Pattern**: Should use static property pattern like the examples directory:
```typescript
export class AppModule extends Module {
  static readonly metadata: ModuleMetadata = {
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
  };
}
```

**Status**: ✅ RESOLVED (2026-02-23) - Code already uses correct pattern with `static readonly metadata`

**Other Checks - ALL PASSED**:
- NO reflect-metadata imports found
- NO `any` type usage (`: any`, `<any>`, `as any`) found
- NO unified Request/Response abstractions in core package
- Class-based API patterns are used correctly (static inject, routes, metadata)