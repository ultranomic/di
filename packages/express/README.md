# @voxeljs/express

Express HTTP adapter for Voxel. Passes through native Express types with no wrapper abstractions.

## Installation

```bash
pnpm add @voxeljs/express express
```

## Quick Start

```typescript
import { Container } from '@voxeljs/core';
import { ExpressAdapter } from '@voxeljs/express';
import type { Request, Response } from 'express';

// Define a controller
class UserController {
  static readonly inject = {} as const;

  static readonly routes = [{ method: 'GET', path: '/users/:id', handler: 'getUser' }] as const;

  constructor(private deps: typeof UserController.inject) {}

  async getUser(req: Request, res: Response) {
    // req.params.id is typed from the route path
    res.json({ id: req.params.id, name: 'Alice' });
  }
}

// Create container and register controller
const container = new Container();
container
  .register(UserController, (c) => {
    return new UserController(c.buildDeps(UserController.inject));
  })
  .asTransient();

// Create adapter and register routes
const adapter = new ExpressAdapter(container);
adapter.registerController(UserController);

// Start server
await adapter.listen(3000);
console.log('Server running on http://localhost:3000');
```

## API Reference

### `ExpressAdapter`

The main adapter class that bridges Voxel controllers with Express.

#### Constructor

```typescript
new ExpressAdapter(container: ResolverInterface)
```

Creates a new Express adapter with the given DI container. The adapter automatically configures JSON body parsing.

#### `registerController(ControllerClass)`

```typescript
adapter.registerController(UserController): void
```

Registers all routes defined in a controller's `routes` metadata. Each route handler is resolved from the container on every request.

#### `listen(port)`

```typescript
await adapter.listen(3000): Promise<void>
```

Starts the HTTP server on the specified port. Returns a promise that resolves when the server is ready.

#### `close()`

```typescript
await adapter.close(): Promise<void>
```

Stops the HTTP server. Safe to call multiple times. Returns immediately if the server is not running.

#### `getApp()`

```typescript
const app = adapter.getApp(): Express
```

Returns the underlying Express application instance. Use this to add middleware, mount sub-apps, or configure Express directly.

## Using Native Express Features

The adapter passes through native Express `Request` and `Response` types. You can use any Express middleware or features.

```typescript
import type { Request, Response, NextFunction } from 'express';

class AuthController {
  static readonly inject = { users: 'UserService' } as const;

  static readonly routes = [{ method: 'POST', path: '/login', handler: 'login' }] as const;

  constructor(private deps: typeof AuthController.inject) {}

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const token = await this.deps.users.authenticate(email, password);

    if (!token) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    res.json({ token });
  }
}

// Add custom middleware via getApp()
const adapter = new ExpressAdapter(container);
adapter.getApp().use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
adapter.registerController(AuthController);
```

## Error Handling

The adapter catches errors in route handlers and returns a 500 response with the error message.

```typescript
// Unhandled errors become 500 responses
async getUser(req: Request, res: Response) {
  throw new Error('Database connection failed')
  // Response: { "error": "Database connection failed" }
}
```

For custom error handling, add an error middleware via `getApp()`.

## Request-Scoped Dependencies

Use child containers for request-scoped dependencies.

```typescript
import { Container } from '@voxeljs/core';
import { ExpressAdapter } from '@voxeljs/express';

const container = new Container();
container.register('RequestContext', RequestContext).asScoped();

const adapter = new ExpressAdapter(container);

// Create a scope per request
adapter.getApp().use((req, _res, next) => {
  req.container = container.createScope();
  next();
});
```

## TypeScript

This package includes TypeScript definitions. The `Request` and `Response` types are re-exported from Express.

```typescript
import type { Request, Response } from '@voxeljs/express';
```

## License

MIT
