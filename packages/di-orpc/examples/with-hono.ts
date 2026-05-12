// oxlint-disable max-classes-per-file, no-console
/**
 * with-hono.ts — Auto-mounting ORPC on Hono HTTP server
 *
 * Demonstrates: HonoModule, OrpcModule auto-mount, REST + RPC side-by-side
 * Run: node libs/di-orpc/examples/with-hono.ts
 */

import { Container, Module } from '@ultranomic/di';
import { Controller, HonoModule } from '@ultranomic/di-hono';
import { z } from 'zod';
import { OrpcModule, OrpcRouter } from '../src/index.ts';

// ---------------------------------------------------------------------------
// 1. Define a Hono controller for REST endpoints
// ---------------------------------------------------------------------------
class UserController extends Controller({ path: '/user' }) {
  public check = this.route({
    method: 'GET',
    path: '/',
    handler: (c) => c.json({ status: 'ok' }),
  });
}

// ---------------------------------------------------------------------------
// 2. Define an ORPC router for RPC endpoints
// ---------------------------------------------------------------------------
class UserRouter extends OrpcRouter({ path: 'user' }) {
  public list = this.orpc.input(z.object({})).handler(() => [{ id: '1', name: 'Alice' }]);
}

class UserModule extends Module({
  providers: [UserController, UserRouter],
  exports: [UserController, UserRouter],
}) {}

// ---------------------------------------------------------------------------
// 3. Compose modules — AppModule extends Module, imports HttpModule + OrpcModule
// ---------------------------------------------------------------------------
class HttpModule extends HonoModule({
  imports: [OrpcModule({ prefix: '/rpc' })],
  options: () => ({ port: 3000, host: '0.0.0.0' }),
}) {}

class AppModule extends Module({
  imports: [HttpModule, UserModule],
}) {}

// ---------------------------------------------------------------------------
// 4. Start and use
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const container = new Container(AppModule);
  await container.start();

  // await container.stop();
}

main().catch(console.error);
