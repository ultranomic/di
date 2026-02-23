/**
 * Hono RPC Example
 *
 * This example demonstrates:
 * 1. Creating a controller with typed routes
 * 2. Setting up a container with dependency injection
 * 3. Creating a HonoAdapter and registering controllers
 * 4. Exporting the app type for RPC client generation
 * 5. Creating a type-safe client using hc or createRpcClient
 * 6. Making typed requests with full autocomplete support
 *
 * Usage:
 *   pnpm dev - Start the server
 *
 * The server will start on http://localhost:3000
 *
 * To test the RPC client, run the client in a separate terminal:
 *   pnpm run client
 */
import { bootstrap } from './server.js';

// Start the server
bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
