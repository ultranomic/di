import type { ModuleClass } from '@ultranomic/di';
import { Container, DIError, Injectable, Module, SCOPE } from '@ultranomic/di';
import { Controller, HonoModule, HonoService } from '@ultranomic/di-hono';
import { ORPCError } from '@orpc/server';
import { StandardRPCHandler } from '@orpc/server/standard';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';
import { OrpcRequestContext } from './orpc-request-context.ts';
import { OrpcModule } from './orpc-module.ts';
import { OrpcRouter } from './orpc-router.ts';
import { OrpcService } from './orpc-service.ts';
import type { OrpcModuleOptions } from './types.ts';

const setupModule = async (moduleClass: ModuleClass) => {
  const container = new Container(moduleClass);
  await container.start();
  const service = container.resolve(OrpcService);
  const handler = service.handler;
  return { container, service, handler };
};

let container: Container;

afterEach(async () => {
  if (container) await container.stop();
});

describe('OrpcService', () => {
  describe('basics', () => {
    it('has _scope === "singleton"', () => {
      expect(OrpcService._scope).toBe('SINGLETON');
    });

    it('resolves via Container', async () => {
      class TestModule extends Module({ imports: [OrpcModule()] }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);
      expect(service).toBeInstanceOf(OrpcService);
    });

    it('handler is instance of StandardRPCHandler', async () => {
      class TestModule extends Module({ imports: [OrpcModule()] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('handler getter is idempotent — same instance on repeated access', async () => {
      class TestModule extends Module({ imports: [OrpcModule()] }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);
      const handler1 = service.handler;
      const handler2 = service.handler;
      expect(handler1).toBe(handler2);
    });

    it('onReady returns void (not Promise)', async () => {
      class TestModule extends Module({ imports: [OrpcModule()] }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);
      expect(service.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('onStop returns void (not Promise)', () => {
      const service = new OrpcService();
      const result = service.onStop({} as Container);
      expect(result).toBeUndefined();
    });
  });

  describe('eager initialization', () => {
    it('handler built during onReady — immediately available after container start', async () => {
      class UserRouter extends OrpcRouter({ path: 'user' }) {
        get = this.orpc
          .input(z.object({ id: z.string() }))
          .handler(async ({ input }) => ({ id: input.id }));
      }

      class TestModule extends Module({ imports: [OrpcModule()], providers: [UserRouter] }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);

      const handler = service.handler;
      expect(handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('handler throws DIError when accessed before container start', () => {
      const service = new OrpcService();
      expect(() => service.handler).toThrow(DIError);
      expect(() => service.handler).toThrow('OrpcService handler accessed before container start');
    });

    it('handler throws CONTAINER_NOT_STARTED DIError code', () => {
      const service = new OrpcService();
      try {
        void service.handler;
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DIError);
        expect((err as DIError).code).toBe('CONTAINER_NOT_STARTED');
      }
    });
  });

  describe('router discovery', () => {
    it('finds _isOrpcRouter classes in container.sorted', async () => {
      class UserRouter extends OrpcRouter({ path: 'user' }) {
        get = this.orpc
          .input(z.object({ id: z.string() }))
          .handler(async ({ input }) => ({ id: input.id }));
      }

      class TestModule extends Module({ imports: [OrpcModule()], providers: [UserRouter] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('skips non-router providers', async () => {
      class SomeService extends Injectable({ scope: SCOPE.SINGLETON }) {
        doStuff() {
          return 'stuff';
        }
      }

      class UserRouter extends OrpcRouter({ path: 'user' }) {
        get = this.orpc.handler(async () => ({ ok: true }));
      }

      class TestModule extends Module({
        imports: [OrpcModule()],
        providers: [SomeService, UserRouter],
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('multiple routers discovered', async () => {
      class UserRouter extends OrpcRouter({ path: 'user' }) {
        get = this.orpc.handler(async () => ({ id: '1' }));
      }

      class ProductRouter extends OrpcRouter({ path: 'product' }) {
        list = this.orpc.handler(async () => []);
      }

      class TestModule extends Module({
        imports: [OrpcModule()],
        providers: [UserRouter, ProductRouter],
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });
  });

  describe('router tree building', () => {
    it('procedures nested under _orpcPath', async () => {
      class UserRouter extends OrpcRouter({ path: 'user' }) {
        get = this.orpc
          .input(z.object({ id: z.string() }))
          .handler(async ({ input }) => ({ id: input.id }));
        list = this.orpc.handler(async () => []);
      }

      class TestModule extends Module({ imports: [OrpcModule()], providers: [UserRouter] }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);

      expect(service.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('router with no procedures produces empty entry (skipped)', async () => {
      class EmptyRouter extends OrpcRouter({ path: 'empty' }) {}

      class TestModule extends Module({ imports: [OrpcModule()], providers: [EmptyRouter] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('empty module — no routers → empty router tree, handler still created', async () => {
      class TestModule extends Module({ imports: [OrpcModule()] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });
  });

  describe('duplicate path detection', () => {
    it('duplicate _orpcPath throws DIError with DUPLICATE_PROVIDER', async () => {
      class Router1 extends OrpcRouter({ path: 'user' }) {
        get = this.orpc.handler(async () => ({ id: '1' }));
      }

      class Router2 extends OrpcRouter({ path: 'user' }) {
        list = this.orpc.handler(async () => []);
      }

      class TestModule extends Module({ imports: [OrpcModule()], providers: [Router1, Router2] }) {}

      container = new Container(TestModule);

      try {
        await container.start();
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DIError);
        expect((err as DIError).message).toContain("Duplicate ORPC router path: 'user'");
      }

      container = undefined as unknown as Container;
    });
  });

  describe('onStop resets state', () => {
    it('handler undefined after stop — accessing throws DIError', async () => {
      class TestModule extends Module({ imports: [OrpcModule()] }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);

      expect(service.handler).toBeInstanceOf(StandardRPCHandler);

      await container.stop();

      try {
        void service.handler;
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DIError);
        expect((err as DIError).code).toBe('CONTAINER_NOT_STARTED');
      }
    });

    it('can restart after stop', async () => {
      class UserRouter extends OrpcRouter({ path: 'user' }) {
        get = this.orpc.handler(async () => ({ id: '1' }));
      }

      class TestModule extends Module({ imports: [OrpcModule()], providers: [UserRouter] }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);
      expect(service.handler).toBeInstanceOf(StandardRPCHandler);

      await container.stop();

      container = new Container(TestModule);
      await container.start();
      const service2 = container.resolve(OrpcService);
      expect(service2.handler).toBeInstanceOf(StandardRPCHandler);
    });
  });

  describe('options reading', () => {
    it('reads prefix from OrpcModule options', async () => {
      class TestModule extends Module({
        imports: [OrpcModule({ prefix: '/api/orpc' })],
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('reads plugins from OrpcModule options', async () => {
      const initMock = () => {};
      const plugin = { init: initMock };

      class TestModule extends Module({
        imports: [OrpcModule({ plugins: [plugin] as unknown as OrpcModuleOptions['plugins'] })],
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('reads errorInterceptor from OrpcModule options', async () => {
      let interceptorCalled = false;
      const interceptor = async (error: unknown, _context: unknown) => {
        interceptorCalled = true;
        return new ORPCError('INTERNAL', { message: 'Intercepted', cause: error });
      };

      class FailingRouter extends OrpcRouter({ path: 'fail' }) {
        get = this.orpc.handler(async () => {
          throw new Error('boom');
        });
      }

      class TestModule extends Module({
        imports: [OrpcModule({ errorInterceptor: interceptor })],
        providers: [FailingRouter],
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);

      await result.handler.handle(
        {
          method: 'POST',
          url: new URL('http://localhost/fail/get'),
          headers: {},
          body: async () => undefined,
          signal: undefined,
        },
        { context: {} },
      );
      expect(interceptorCalled).toBe(true);
    });

    it('non-OrpcModule module — options undefined, no error', async () => {
      class PlainModule extends Module({
        providers: [OrpcService],
      }) {}

      container = new Container(PlainModule);
      await container.start();
      const service = container.resolve(OrpcService);
      expect(service.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('OrpcModule as import — options read via tree walk', async () => {
      class TestRouter extends OrpcRouter({ path: 'test' }) {
        greet = this.orpc.handler(async () => ({ ok: true }));
      }

      class AppModule extends Module({
        imports: [OrpcModule({ prefix: '/api/orpc' })],
        providers: [TestRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();
      const service = container.resolve(OrpcService);
      expect(service.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('options factory resolve delegates to container.resolve', async () => {
      class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly value = 'from-config';
      }

      let resolvedViaFactory = false;

      class TestModule extends Module({
        imports: [
          OrpcModule({
            options: (resolve) => {
              const config = resolve(ConfigService);
              if (config instanceof ConfigService && config.value === 'from-config') {
                resolvedViaFactory = true;
              }
              return {};
            },
          }),
        ],
        providers: [ConfigService],
      }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(OrpcService);
      expect(service.handler).toBeInstanceOf(StandardRPCHandler);
      expect(resolvedViaFactory).toBe(true);
    });
  });

  describe('request scope & context', () => {
    it('OrpcRequestContext available inside request scope', async () => {
      let capturedContext: unknown;

      class UserRouter extends OrpcRouter({ path: 'user' }) {
        get = this.orpc.handler(async () => {
          capturedContext = OrpcRequestContext.get();
          return { id: '1' };
        });
      }

      class TestModule extends Module({ imports: [OrpcModule()], providers: [UserRouter] }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      await result.service.handle(
        {
          method: 'POST',
          url: new URL('http://localhost/user/get'),
          headers: {},
          body: async () => undefined,
          signal: undefined,
        },
        { context: { testScope: true } },
      );

      expect(capturedContext).toBeDefined();
      expect(capturedContext).toHaveProperty('req');
    });
  });

  describe('procedure enumeration', () => {
    it('only isProcedure-validated properties included', async () => {
      class UserRouter extends OrpcRouter({ path: 'user' }) {
        get = this.orpc
          .input(z.object({ id: z.string() }))
          .handler(async ({ input }) => ({ id: input.id }));
        list = this.orpc.handler(async () => []);

        helperMethod = 'not-a-procedure';
      }

      class TestModule extends Module({ imports: [OrpcModule()], providers: [UserRouter] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('router with only non-procedure properties produces empty entry (skipped)', async () => {
      class NoProcRouter extends OrpcRouter({ path: 'noprocs' }) {
        helperMethod = 'not-a-procedure';
      }

      class TestModule extends Module({ imports: [OrpcModule()], providers: [NoProcRouter] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(result.handler).toBeInstanceOf(StandardRPCHandler);
    });
  });

  describe('error interceptor integration', () => {
    it('error interceptor catches non-ORPCError and transforms it', async () => {
      let interceptedError: unknown;
      let interceptedContext: unknown;

      const errorInterceptor = async (error: unknown, context: unknown) => {
        interceptedError = error;
        interceptedContext = context;
        return new ORPCError('INTERNAL', { message: 'Intercepted', cause: error });
      };

      class FailingRouter extends OrpcRouter({ path: 'fail' }) {
        get = this.orpc.handler(async () => {
          throw new Error('boom');
        });
      }

      class TestModule extends Module({
        imports: [OrpcModule({ errorInterceptor })],
        providers: [FailingRouter],
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      const handlerResult = await result.handler.handle(
        {
          method: 'POST',
          url: new URL('http://localhost/fail/get'),
          headers: {},
          body: async () => undefined,
          signal: undefined,
        },
        { context: { testCtx: true } },
      );

      expect(handlerResult.matched).toBe(true);
      if (handlerResult.matched) {
        expect(handlerResult.response.status).toBeGreaterThanOrEqual(400);
      }
      expect(interceptedError).toBeInstanceOf(Error);
      expect((interceptedError as Error).message).toBe('boom');
      expect(interceptedContext).toEqual({ testCtx: true });
    });

    it('error interceptor does not catch ORPCError — rethrown directly', async () => {
      let interceptorCalled = false;

      const errorInterceptor = async (_error: unknown, _context: unknown) => {
        interceptorCalled = true;
        return new ORPCError('INTERNAL', { message: 'Should not reach' });
      };

      class FailingRouter extends OrpcRouter({ path: 'fail' }) {
        get = this.orpc.handler(async () => {
          throw new ORPCError('NOT_FOUND', { message: 'Not found' });
        });
      }

      class TestModule extends Module({
        imports: [OrpcModule({ errorInterceptor })],
        providers: [FailingRouter],
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      const handlerResult = await result.handler.handle(
        {
          method: 'POST',
          url: new URL('http://localhost/fail/get'),
          headers: {},
          body: async () => undefined,
          signal: undefined,
        },
        { context: {} },
      );

      expect(handlerResult.matched).toBe(true);
      expect(interceptorCalled).toBe(false);
    });
  });

  describe('auto-mount on HonoService', () => {
    it('auto-mounts when HonoModule in module tree (AppModule extends Module)', async () => {
      class TestRouter extends OrpcRouter({ path: 'test' }) {
        greet = this.orpc.handler(async () => ({
          message: 'Hello, World!',
        }));
      }

      class TestHonoModule extends HonoModule({
        options: () => ({ port: 3000, host: '0.0.0.0' }),
      }) {}

      class AppModule extends Module({
        imports: [OrpcModule(), TestHonoModule],
        providers: [TestRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      const _handler = orpcService.handler;

      const honoService = container.resolve(HonoService);
      const app = honoService.hono;

      const response = await app.request('/rpc/test/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ json: { message: 'Hello, World!' } });
    });

    it('auto-mounts when OrpcModule is root (backward compat)', async () => {
      class TestRouter extends OrpcRouter({ path: 'test' }) {
        greet = this.orpc.handler(async () => ({
          message: 'Hello, World!',
        }));
      }

      class TestHonoModule extends HonoModule({
        options: () => ({ port: 3000, host: '0.0.0.0' }),
      }) {}

      class TestOrpcModule extends OrpcModule() {}

      class AppModule extends Module({
        imports: [TestOrpcModule, TestHonoModule],
        providers: [TestRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      const _handler = orpcService.handler;

      const honoService = container.resolve(HonoService);
      const app = honoService.hono;

      const response = await app.request('/rpc/test/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ json: { message: 'Hello, World!' } });
    });

    it('no mount when HonoModule NOT in module tree', async () => {
      class TestRouter extends OrpcRouter({ path: 'test' }) {
        greet = this.orpc.handler(async () => ({ ok: true }));
      }

      class TestModule extends Module({
        imports: [OrpcModule()],
        providers: [TestRouter],
      }) {}

      container = new Container(TestModule);
      await container.start();

      const service = container.resolve(OrpcService);
      expect(service.handler).toBeInstanceOf(StandardRPCHandler);
    });

    it('mount happens after HonoService lazy init', async () => {
      class TestController extends Controller({
        path: '/api',
      }) {
        health = this.route({
          method: 'GET',
          path: '/health',
          handler: async (c) => c.json({ status: 'ok' }),
        });
      }

      class TestRouter extends OrpcRouter({ path: 'test' }) {
        greet = this.orpc.handler(async () => ({ ok: true }));
      }

      class TestHonoModule extends HonoModule({
        providers: [TestController],
        exports: [TestController],
        options: () => ({ port: 3000, host: '0.0.0.0' }),
      }) {}

      class AppModule extends Module({
        imports: [OrpcModule(), TestHonoModule],
        providers: [TestRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      const _handler = orpcService.handler;

      const honoService = container.resolve(HonoService);
      const app = honoService.hono;

      const healthResponse = await app.request('/api/health');
      expect(healthResponse.status).toBe(200);

      const orpcResponse = await app.request('/rpc/test/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(orpcResponse.status).toBe(200);
    });

    it('ORPC context includes honoContext when auto-mounted', async () => {
      let capturedContext: unknown;

      class TestRouter extends OrpcRouter({ path: 'test' }) {
        greet = this.orpc.handler(async () => {
          capturedContext = OrpcRequestContext.get();
          return { ok: true };
        });
      }

      class TestHonoModule extends HonoModule({
        options: () => ({ port: 3000, host: '0.0.0.0' }),
      }) {}

      class AppModule extends Module({
        imports: [OrpcModule(), TestHonoModule],
        providers: [TestRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      const _handler = orpcService.handler;

      const honoService = container.resolve(HonoService);
      const app = honoService.hono;

      await app.request('/rpc/test/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(capturedContext).toBeDefined();
      expect(capturedContext).toHaveProperty('req');
      expect(capturedContext).toHaveProperty('honoContext');
    });
  });
});
