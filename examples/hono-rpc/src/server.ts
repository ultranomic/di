/**
 * Server setup for Hono RPC example
 *
 * Demonstrates:
 * 1. Creating a Container and registering services
 * 2. Creating a HonoAdapter and registering controllers
 * 3. Exporting the app type for RPC client generation
 */
import { Container, type ControllerConstructor } from '@voxeljs/core';
import { HonoAdapter } from '@voxeljs/hono';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import type { Hono } from 'hono';

const PORT = Number(process.env.PORT) || 3000;

/**
 * Setup and start the server
 */
export async function createServer(): Promise<{
  adapter: HonoAdapter;
  app: Hono;
  port: number;
}> {
  // Create container and register services
  const container = new Container();
  container.register('UserService', () => new UserService());
  container.register(UserController as ControllerConstructor, (c) => {
    return new UserController(...(c.buildDeps(UserController.inject) as unknown as [UserService]));
  });

  // Create Hono adapter
  const adapter = new HonoAdapter(container);

  // Register controller
  adapter.registerController(UserController as ControllerConstructor);

  // Get the Hono app instance
  const app = adapter.getApp();

  // Add a health check endpoint
  app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Start listening
  await adapter.listen(PORT);

  return { adapter, app, port: PORT };
}

/**
 * Bootstrap the server
 */
export async function bootstrap(): Promise<void> {
  const { adapter, port } = await createServer();

  console.log(`Server running on http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  GET    /health       - Health check');
  console.log('  GET    /users        - List all users');
  console.log('  GET    /users/:id    - Get user by ID');
  console.log('  POST   /users        - Create a new user');
  console.log('  PUT    /users/:id    - Update a user');
  console.log('  DELETE /users/:id    - Delete a user');
  console.log('\nThe app type is exported for RPC client generation.');
  console.log('See src/client.ts for usage examples.');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await adapter.close();
    process.exit(0);
  });
}
