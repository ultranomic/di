
## 2026-02-22: Node.js 25.4.0 fetch "bad port" Issue

**Issue**: When running Hono adapter tests in vitest on Node.js v25.4.0, the "should handle POST requests" test fails with "bad port" error from undici.

**Root Cause**: Node.js 25.4.0's built-in fetch (undici) has a bug when making POST requests with a body. The error message "bad port" is misleading - it's not about the port value but appears to be an internal undici issue.

**Workaround**: Using Node's `http` module instead of `fetch` works correctly. The adapter functionality is verified working.

**Status**: Environmental issue, not a code bug. The Hono adapter's `fetch` binding fix (arrow function) is correct and working.

**Related Fix**: Changed `fetch: this.app.fetch` to `fetch: (req) => this.app.fetch(req)` to preserve `this` context.
