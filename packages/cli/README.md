# @voxeljs/cli

Command-line tool for scaffolding Voxel projects. Generates a working TypeScript application with Express, complete with services, controllers, and modules.

## Installation

```bash
# Use directly with npx (recommended)
npx @voxeljs/cli new my-app

# Or install globally
pnpm add -g @voxeljs/cli
voxel new my-app
```

## Commands

### `voxel new <project-name>`

Creates a new Voxel project in a directory with the given name.

```bash
voxel new my-api
```

The project name must use lowercase letters, numbers, and hyphens only. It must start with a letter.

**Options:**

| Flag           | Description       |
| -------------- | ----------------- |
| `--help`, `-h` | Show help message |

## Generated Project Structure

Running `voxel new my-api` creates:

```
my-api/
  package.json
  tsconfig.json
  src/
    index.ts
    app.ts
    services/
      user.service.ts
```

### package.json

Pre-configured with Voxel dependencies and scripts:

```json
{
  "name": "my-api",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "node --watch src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@voxeljs/core": "latest",
    "@voxeljs/express": "latest",
    "express": "5.0.0"
  },
  "devDependencies": {
    "@types/express": "5.0.0",
    "@types/node": "22.0.0",
    "typescript": "5.0.0"
  }
}
```

### src/index.ts

Application entry point. Creates the container and starts the server:

```typescript
import { Container } from '@voxeljs/core';
import { ExpressAdapter } from '@voxeljs/express';
import { AppModule, UserController } from './app.ts';

const PORT = Number(process.env['PORT']) || 3000;

async function bootstrap(): Promise<void> {
  const container = new Container();

  const appModule = new AppModule();
  appModule.register(container);

  const adapter = new ExpressAdapter(container);
  adapter.registerController(UserController);

  await adapter.listen(PORT);
  console.log(`Server running on http://localhost:${PORT}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

### src/app.ts

Root module with a sample controller demonstrating the Voxel pattern:

```typescript
import { Module } from '@voxeljs/core';
import type { Request, Response } from 'express';
import { UserService } from './services/user.service.ts';

export class UserController {
  static readonly inject = {
    users: UserService,
  } as const;

  static readonly routes = [
    { method: 'GET', path: '/users', handler: 'list' },
    { method: 'GET', path: '/users/:id', handler: 'get' },
  ] as const;

  constructor(private deps: typeof UserController.inject) {}

  async list(_req: Request, res: Response): Promise<void> {
    const users = await this.deps.users.findAll();
    res.json(users);
  }

  async get(req: Request, res: Response): Promise<void> {
    const user = await this.deps.users.findById(req.params.id as string);
    if (user === null) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  }
}

export class AppModule extends Module {
  static readonly metadata = {
    providers: [UserService],
    exports: [UserService],
  } as const;

  register(container: import('@voxeljs/core').ContainerInterface): void {
    container
      .register(UserService, (c) => {
        const deps = c.buildDeps(UserService.inject);
        return new UserService(deps);
      })
      .asSingleton();

    container.register(UserController, (c) => {
      const deps = c.buildDeps(UserController.inject);
      return new UserController(deps);
    });
  }
}
```

### src/services/user.service.ts

Sample service demonstrating dependency injection:

```typescript
export class UserService {
  static readonly inject = {} as const;

  constructor(_deps: typeof UserService.inject) {}

  async findAll(): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Smith' },
    ];
  }

  async findById(id: string): Promise<{ id: string; name: string } | null> {
    const users = await this.findAll();
    return users.find((u) => u.id === id) ?? null;
  }
}
```

## Next Steps

After creating a project:

```bash
cd my-api
pnpm install
pnpm dev
```

The server starts at `http://localhost:3000`. Try the sample endpoints:

```bash
curl http://localhost:3000/users
curl http://localhost:3000/users/1
```

## Related Packages

| Package            | Description                                         |
| ------------------ | --------------------------------------------------- |
| `@voxeljs/core`    | DI container, modules, controllers, lifecycle hooks |
| `@voxeljs/express` | Express HTTP adapter                                |
| `@voxeljs/fastify` | Fastify HTTP adapter                                |
| `@voxeljs/hono`    | Hono HTTP adapter                                   |
| `@voxeljs/testing` | Testing utilities                                   |

## License

MIT
