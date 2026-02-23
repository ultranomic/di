# @voxeljs/hono

Hono HTTP adapter for Voxel framework.

## Installation

```bash
pnpm add @voxeljs/hono hono @hono/node-server
```

## Quick Start

```typescript
import { Container } from '@voxeljs/core';
import { HonoAdapter } from '@voxeljs/hono';
import { UserController } from './controllers/user.controller.ts';
import { UserService } from './services/user.service.ts';

const container = new Container();

// Register providers
container
  .register(UserService, (c) => {
    return new UserService(c.buildDeps(UserService.inject));
  })
  .asSingleton();

// Register controllers
container.register(UserController, (c) => {
  return new UserController(c.buildDeps(UserController.inject));
});

// Create adapter
const adapter = new HonoAdapter(container);

// Register controllers
adapter.registerController(UserController);

// Start server
await adapter.listen(3000);
console.log('Server running on http://localhost:3000');
```

## API

### Constructor

```typescript
const adapter = new HonoAdapter(container);
```

Takes a `ResolverInterface` (container) for resolving controllers.

### registerController

```typescript
adapter.registerController(UserController);
```

Registers a controller's routes with the Hono app. Routes are extracted from the controller's `static readonly routes` array.

### listen

```typescript
await adapter.listen(3000);
```

Starts the HTTP server on the specified port.

### close

```typescript
await adapter.close();
```

Stops the HTTP server.

### getApp

```typescript
const hono = adapter.getApp();
```

Returns the underlying Hono instance for advanced configuration.

## Controller Example

```typescript
import { Controller } from '@voxeljs/core';
import type { ControllerRoute } from '@voxeljs/core';
import type { Context } from 'hono';

class UserController extends Controller {
  static readonly inject = { users: UserService } as const;

  static readonly routes = [
    { method: 'GET', path: '/users', handler: 'list' },
    { method: 'GET', path: '/users/:id', handler: 'get' },
  ] as const satisfies ControllerRoute<UserController>[];

  constructor(private deps: typeof UserController.inject) {
    super();
  }

  async list(c: Context) {
    const users = await this.deps.users.findAll();
    return c.json(users);
  }

  async get(c: Context) {
    const user = await this.deps.users.findById(c.req.param('id'));
    if (!user) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json(user);
  }
}
```

## HTTP Methods

Supported methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`

## Native Types

This adapter passes through native Hono types (`Context`). No wrapper abstractions.

## License

MIT
