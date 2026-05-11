// oxlint-disable max-classes-per-file, no-console
/**
 * with-middleware.ts — Auth middleware with ORPC
 *
 * Demonstrates: OrpcMiddleware, .use(), context enrichment
 * Run: node libs/di-orpc/examples/with-middleware.ts
 */

import { Container, Module } from '@ultranomic/di';
import { z } from 'zod';
import { OrpcMiddleware, OrpcModule, OrpcRouter, OrpcService } from '../src/index.ts';

// ---------------------------------------------------------------------------
// 1. Define auth middleware
// ---------------------------------------------------------------------------
class AuthMiddleware extends OrpcMiddleware({}) {
  public requireAuth = this.orpc.middleware(({ next }) => {
    // In production, validate auth token here
    return next({ context: { userId: 'authenticated-user-id' } });
  });
}

// ---------------------------------------------------------------------------
// 2. Define a router that uses the middleware
// ---------------------------------------------------------------------------
class ProtectedRouter extends OrpcRouter({
  path: 'protected',
  inject: [['auth', AuthMiddleware]],
}) {
  public getProfile = this.orpc
    .use(this.inject.auth.requireAuth)
    .input(z.object({}))
    .handler(({ context }) => {
      return { userId: context.userId, name: 'Protected User' };
    });
}

// ---------------------------------------------------------------------------
// 3. Compose modules — OrpcModule as import, routers as providers
// ---------------------------------------------------------------------------
class AppModule extends Module({
  imports: [OrpcModule()],
  providers: [AuthMiddleware, ProtectedRouter],
}) {}
// ---------------------------------------------------------------------------
// 4. Start and use
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const container = new Container(AppModule);
  await container.start();

  const _orpcService = container.resolve(OrpcService);
  console.log('ORPC with auth middleware ready');

  await container.stop();
}

main().catch(console.error);
