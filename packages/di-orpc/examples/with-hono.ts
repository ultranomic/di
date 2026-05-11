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
class HealthController extends Controller({ path: '/health' }) {
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

// ---------------------------------------------------------------------------
// 3. Compose modules — AppModule extends Module, imports HttpModule + OrpcModule
// ---------------------------------------------------------------------------
class HttpModule extends HonoModule({
  providers: [HealthController],
  options: () => ({ port: 3000, host: '0.0.0.0' }),
}) {}

class AppModule extends Module({
  imports: [HttpModule, OrpcModule()],
  providers: [UserRouter],
}) {}

// ---------------------------------------------------------------------------
// 4. Start and use
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const container = new Container(AppModule);
  await container.start();
  console.log('Server running at http://localhost:3000');
  console.log('REST: GET /health');
  console.log('ORPC: POST /rpc/user/list');
  await container.stop();
}

main().catch(console.error);
