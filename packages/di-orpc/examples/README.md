# @ultranomic/di-orpc Examples

| Example              | Description                       | Key Concepts                               |
| -------------------- | --------------------------------- | ------------------------------------------ |
| `basic-usage.ts`     | Minimal ORPC router with DI       | OrpcRouter, OrpcModule, Container          |
| `with-middleware.ts` | Auth middleware with ORPC         | OrpcMiddleware, .use(), context enrichment |
| `with-hono.ts`       | Auto-mounting on Hono HTTP server | HonoModule, auto-mount, REST + RPC         |

## Running Examples

```bash
# From workspace root
cd libs/di-orpc

# Typecheck examples
pnpm typecheck

# Run an example
node examples/basic-usage.ts
```
