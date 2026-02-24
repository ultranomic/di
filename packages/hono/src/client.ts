import { hc } from 'hono/client';
import type { Hono } from 'hono';
import type { HonoAdapter } from './adapter.js';

/**
 * Re-export Hono's hc (client) utility for creating type-safe API clients
 */
export { hc };

/**
 * Type helper to infer the Hono app type from any object that has a getApp() method
 * This works with HonoAdapter and other adapter patterns
 */
export type InferHonoAppType<T> = T extends { getApp(): infer R } ? R : never;

/**
 * Type helper to extract the routes schema from a Hono app
 * Useful for getting the typed client interface
 */
export type InferRoutesFromApp<T> = T extends Hono<infer E, infer S> ? S : never;

/**
 * Create a typed RPC client from a HonoAdapter instance
 *
 * @example
 * ```typescript
 * const adapter = new HonoAdapter(container)
 * // ... register controllers ...
 * const client = createRpcClient(adapter, 'http://localhost:3000')
 *
 * // Now you have a fully typed client
 * const result = await client.users.$get()
 * const user = await client.users[':id'].$get({ param: { id: '123' } })
 * ```
 */
export function createRpcClient<T extends { getApp(): Hono }>(adapter: T, baseUrl: string) {
  const app = adapter.getApp();
  return hc<typeof app>(baseUrl);
}

/**
 * Create a typed RPC client from a Hono app directly
 * Useful when you have access to the underlying Hono instance
 *
 * @example
 * ```typescript
 * const app = new Hono()
 * // ... setup routes ...
 * const client = createClientFromApp(app, 'http://localhost:3000')
 * ```
 */
export function createClientFromApp<T extends Hono>(app: T, baseUrl: string): ReturnType<typeof hc<typeof app>> {
  return hc<typeof app>(baseUrl);
}

/**
 * Type for the RPC client returned by createRpcClient
 * Provides explicit typing for the client object
 */
export type RpcClient<T extends { getApp(): Hono }> = ReturnType<typeof createRpcClient<T>>;

/**
 * Type for the app client returned by createClientFromApp
 */
export type AppClient<T extends Hono> = ReturnType<typeof createClientFromApp<T>>;
