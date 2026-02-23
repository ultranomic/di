# Hono RPC Example

This example demonstrates type-safe RPC client usage with Voxel and Hono. It shows how to create a server with typed routes and use the generated types for a fully type-safe client.

## Features Demonstrated

1. **Creating a controller with routes** - `src/user.controller.ts`
   - Defines routes using static metadata
   - Uses Hono `Context` for handling requests
   - Returns typed JSON responses

2. **Setting up a module and container** - `src/server.ts`
   - Creates a `Container` for dependency injection
   - Registers services and controllers
   - Creates a `HonoAdapter` with the container

3. **Creating a HonoAdapter** - `src/server.ts`
   - Registers controllers with the adapter
   - Exports the Hono app for RPC client generation

4. **Type-safe RPC client** - `src/client.ts`
   - Uses `hc` from `@voxeljs/hono` for type-safe API calls
   - Demonstrates `createRpcClient` utility
   - Shows full autocomplete and type safety

## Project Structure

```
examples/hono-rpc/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts          # Entry point (starts server)
    ├── server.ts         # Server setup with HonoAdapter
    ├── client.ts         # Type-safe RPC client example
    ├── user.controller.ts # User controller with routes
    └── user.service.ts   # In-memory user service
```

## Installation

```bash
pnpm install
```

## Running the Example

Start the server:

```bash
pnpm dev
```

The server will start on `http://localhost:3000` with the following endpoints:

- `GET /health` - Health check
- `GET /users` - List all users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create a new user
- `PUT /users/:id` - Update a user
- `DELETE /users/:id` - Delete a user

## RPC Client Usage

The example demonstrates two ways to create a type-safe RPC client:

### Method 1: Using `hc` directly

```typescript
import { hc } from '@voxeljs/hono';
import type { AppType } from './server';

const client = hc<AppType>('http://localhost:3000');

// Fully typed requests with autocomplete
const usersRes = await client.users.$get();
const users = await usersRes.json();

const userRes = await client.users[':id'].$get({
  param: { id: '1' },
});
const user = await userRes.json();
```

### Method 2: Using `createRpcClient`

```typescript
import { createRpcClient, HonoAdapter } from '@voxeljs/hono';

const adapter = new HonoAdapter(container);
// ... register controllers ...

const client = createRpcClient(adapter, 'http://localhost:3000');

const users = await client.users.$get();
```

## Type Safety

The key benefit of this approach is full type safety:

1. **Request parameters are validated** - TypeScript will error if you pass wrong types
2. **Response types are inferred** - You get autocomplete for response data
3. **Route paths are type-checked** - No typos in route names

## Example: Making a Typed Request

```typescript
// POST /users - Create a new user
const response = await client.users.$post({
  json: {
    name: 'John Doe',
    email: 'john@example.com',
  },
});

// TypeScript knows the response type
const { data } = await response.json();
// data.id, data.name, data.email are all typed
```

## Testing the RPC Client

You can test the RPC client manually:

1. Start the server: `pnpm dev`
2. In another terminal, run a Node.js REPL or create a test file:

```typescript
import { hc } from '@voxeljs/hono';

const client = hc<typeof app>('http://localhost:3000');

// List all users
const users = await client.users.$get();
console.log(await users.json());

// Get a specific user
const user = await client.users[':id'].$get({ param: { id: '1' } });
console.log(await user.json());
```

## Key Concepts

### HonoAdapter

The `HonoAdapter` bridges Voxel controllers with Hono's routing system:

```typescript
const adapter = new HonoAdapter(container);
adapter.registerController(UserController);
const app = adapter.getApp();
```

### Type Inference

Hono provides excellent type inference. The `hc` function extracts types from your Hono app:

```typescript
type AppType = typeof app extends Hono<_, infer S> ? S : never;
const client = hc<AppType>(baseUrl);
```

### Controller Metadata

Routes are defined using static metadata on the controller:

```typescript
static readonly metadata: ControllerMetadata = {
  basePath: '/users',
  routes: [
    { method: 'GET', path: '/', handler: 'findAll' },
    { method: 'POST', path: '/', handler: 'create' },
  ] as const,
};
```

## License

MIT
