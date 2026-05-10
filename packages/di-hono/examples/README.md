# @ultranomic/di-hono Examples

Runnable examples for the `@ultranomic/di-hono` Hono + DI integration library.

## Run

```bash
node libs/di-hono/examples/basic-controller.ts
node libs/di-hono/examples/validation.ts
node libs/di-hono/examples/request-context.ts
node libs/di-hono/examples/multiple-controllers.ts
node libs/di-hono/examples/dynamic-options.ts
```

## Examples

| File                      | What it shows                                                                 |
| ------------------------- | ----------------------------------------------------------------------------- |
| `basic-controller.ts`     | Controller with GET/POST routes, constructor DI, `app.fetch()` testing        |
| `validation.ts`           | Zod v4 native Standard Schema, json/query/param validation, valid & invalid   |
| `request-context.ts`      | `RequestContext.get()` inside handlers, singleton service per-request context |
| `multiple-controllers.ts` | Multiple controllers at different paths, shared service, `HonoModule`         |
| `dynamic-options.ts`      | Options factory with `resolve()`, config-driven module setup                  |

## Key Patterns

```typescript
import { Controller, HonoModule, HonoService } from "../src/index.ts";
import { Injectable, Module, SCOPE, Container } from "@ultranomic/di";

// Define a controller - dependencies via this.inject
class MyController extends Controller({
  path: "/my",
  inject: [["service", MyService]],
}) {
  list = this.route({
    method: "GET",
    path: "/",
    handler: async (c) => c.json({ items: [] }),
  });
}

// Feature module groups controllers and services
class MyModule extends Module({
  providers: [MyService, MyController],
  exports: [MyController],
}) {}

// HttpModule provides the Hono app
class HttpModule extends HonoModule() {}

// AppModule imports everything
class AppModule extends Module({
  imports: [HttpModule, MyModule],
}) {}

// Start and use
const container = new Container(AppModule);
await container.start();
const app = container.resolve(HonoService).hono;
const res = await app.fetch(new Request("http://localhost/my"));
await container.stop();
```
