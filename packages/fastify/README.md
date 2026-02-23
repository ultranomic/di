# @voxeljs/fastify

Fastify HTTP adapter for Voxel. Passes through native Fastify types.

## Installation

```bash
pnpm add @voxeljs/fastify fastify
```

## Quick Start

```typescript
import { Container } from '@voxeljs/core'
import { FastifyAdapter } from '@voxeljs/fastify'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { ControllerRoute } from '@voxeljs/core'

// Define a service
class UserService {
  static readonly inject = {} as const
  
  constructor(private deps: typeof UserService.inject) {}
  
  private users = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' }
  ]
  
  async findById(id: string) {
    return this.users.find(u => u.id === id) ?? null
  }
  
  async create(data: { name: string }) {
    const user = { id: String(this.users.length + 1), ...data }
    this.users.push(user)
    return user
  }
}

// Define a controller
class UserController {
  static readonly inject = { users: UserService } as const
  
  static readonly routes = [
    { method: 'GET', path: '/users/:id', handler: 'get' },
    { method: 'POST', path: '/users', handler: 'create' }
  ] as const satisfies ControllerRoute<UserController>[]
  
  constructor(private deps: typeof UserController.inject) {}
  
  async get(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = await this.deps.users.findById(req.params.id)
    if (!user) {
      return reply.status(404).send({ error: 'Not found' })
    }
    return reply.send(user)
  }
  
  async create(req: FastifyRequest<{ Body: { name: string } }>, reply: FastifyReply) {
    const user = await this.deps.users.create(req.body)
    return reply.status(201).send(user)
  }
}

// Bootstrap
const container = new Container()

container.register(UserService, (c) => {
  return new UserService(c.buildDeps(UserService.inject))
}).asSingleton()

container.register(UserController, (c) => {
  return new UserController(c.buildDeps(UserController.inject))
}).asTransient()

const adapter = new FastifyAdapter(container)
adapter.registerController(UserController)

await adapter.listen(3000)
console.log('Server running on http://localhost:3000')
```

## API Reference

### `FastifyAdapter`

```typescript
import { FastifyAdapter } from '@voxeljs/fastify'
```

#### Constructor

```typescript
new FastifyAdapter(container: ResolverInterface)
```

Creates a new Fastify adapter with the given DI container. Internally creates a Fastify instance with `ignoreTrailingSlash: true`.

#### `registerController()`

```typescript
adapter.registerController(ControllerClass: ControllerConstructor): void
```

Registers all routes from a controller class. Routes are read from the controller's static `metadata.routes` array and registered with Fastify.

Each route handler resolves the controller from the container, so transient controllers get a fresh instance per request.

#### `listen()`

```typescript
await adapter.listen(port: number): Promise<void>
```

Starts the Fastify server on the specified port. Binds to `0.0.0.0` by default.

#### `close()`

```typescript
await adapter.close(): Promise<void>
```

Closes the Fastify server and releases resources.

#### `getApp()`

```typescript
const app = adapter.getApp(): FastifyInstance
```

Returns the underlying Fastify instance. Use this to:
- Register Fastify plugins
- Add hooks
- Configure middleware
- Access advanced Fastify features

```typescript
const app = adapter.getApp()

// Register a plugin
await app.register(import('@fastify/cors'), {
  origin: true
})

// Add a hook
app.addHook('onRequest', async (request, reply) => {
  request.log.info({ url: request.url }, 'incoming request')
})
```

## Native Types

The adapter passes through native Fastify types. No wrapper abstractions.

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify'

class MyController {
  static readonly inject = { service: 'MyService' } as const
  
  constructor(private deps: typeof MyController.inject) {}
  
  async handler(req: FastifyRequest, reply: FastifyReply) {
    // req is a native FastifyRequest
    // reply is a native FastifyReply
    return reply.send({ hello: 'world' })
  }
}
```

You can use Fastify's typed generics for params, body, query, and headers:

```typescript
interface UserParams {
  Params: { id: string }
}

interface CreateBody {
  Body: { name: string; email: string }
}

async get(
  req: FastifyRequest<UserParams>,
  reply: FastifyReply
) {
  const id = req.params.id  // typed as string
}

async create(
  req: FastifyRequest<CreateBody>,
  reply: FastifyReply
) {
  const { name, email } = req.body  // typed
}
```

## Error Handling

The adapter catches errors in route handlers and returns a 500 response:

```typescript
// On error, returns:
// { "error": "Error message" } with status 500
```

For custom error handling, access the Fastify instance directly:

```typescript
const app = adapter.getApp()

app.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return reply.status(400).send({ error: 'Validation failed', details: error.validation })
  }
  return reply.status(500).send({ error: 'Internal server error' })
})
```

## License

MIT
