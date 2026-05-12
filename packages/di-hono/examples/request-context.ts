// oxlint-disable max-classes-per-file, no-console
/**
 * request-context.ts — RequestContext usage in request handlers
 *
 * Demonstrates: custom RequestContext subclass with DI injection
 * Run: node libs/di-hono/examples/request-context.ts
 */

import { Container, Injectable, Module, SCOPE } from '@ultranomic/di';
import { Controller, HonoModule, RequestContext } from '../src/index.ts';

class AppContext extends RequestContext({
  create: (_c) => ({
    requestId: new Date().getTime().toString(),
  }),
}) {}

class AuditService extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [['ctx', AppContext]],
}) {
  #log: string[] = [];

  public record(action: string): void {
    const ctx = this.inject.ctx.get();
    const requestId = ctx?.requestId ?? 'unknown';
    const entry = `[${requestId}] ${action}`;
    this.#log.push(entry);
    console.log(`[AuditService] ${entry}`);
  }

  public getLog(): readonly string[] {
    return this.#log;
  }
}

class DemoController extends Controller({
  path: '/demo',
  inject: [['audit', AuditService]],
}) {
  public handle = this.route({
    method: 'GET',
    path: '/',
    handler: (c) => {
      const requestId = c.req.header('x-request-id') ?? 'unknown';
      this.inject.audit.record(`Request handled: ${requestId}`);
      return c.json({ requestId, message: 'Check console for per-request logs' });
    },
  });
}

class DemoModule extends Module({
  providers: [AppContext, AuditService, DemoController],
  exports: [AuditService, DemoController],
}) {}

class HttpModule extends HonoModule({
  providers: [AppContext],
  options: () => ({ port: 3000, host: '0.0.0.0' }),
  exports: [AppContext],
}) {}

class AppModule extends Module({
  imports: [HttpModule, DemoModule],
}) {}

const main = async (): Promise<void> => {
  const container = new Container(AppModule);
  await container.start();

  // const app = container.resolve(HonoService).hono;

  // // Request 1
  // console.log('--- Request 1 (x-request-id: req-001) ---');
  // const res1 = await app.fetch(
  //   new Request('http://localhost/demo', {
  //     headers: { 'x-request-id': 'req-001' },
  //   }),
  // );
  // console.log('Response:', await res1.json());

  // // Request 2
  // console.log('--- Request 2 (x-request-id: req-002) ---');
  // const res2 = await app.fetch(
  //   new Request('http://localhost/demo', {
  //     headers: { 'x-request-id': 'req-002' },
  //   }),
  // );
  // console.log('Response:', await res2.json());

  // console.log('\nAudit log:');
  // const audit = container.resolve(AuditService);
  // for (const entry of audit.getLog()) {
  //   console.log(`  ${entry}`);
  // }

  // await container.stop();
};

main().catch(console.error);
