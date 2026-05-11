import { Container, DIError, Injectable, Module, SCOPE } from '@ultranomic/di';
import { type Context, type MiddlewareHandler, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';
import { Controller } from './controller.ts';
import { HonoModule } from './hono-module.ts';
import { HonoService, VALIDATION_ERROR_MESSAGE } from './hono-service.ts';
import { RequestContext } from './request-context.ts';

class HonoContext extends RequestContext({
  create: (c) => c,
}) {}
import { expectValidationFailed, setupModule } from './test-helpers.ts';
import type {
  HonoModuleOptionsFactory,
  HttpMethod,
  StandardPathSegment,
  StandardResult,
  StandardSchema,
} from './types.ts';

let container: Container;

afterEach(async () => {
  if (container) await container.stop();
});

describe('HonoService', () => {
  describe('basics', () => {
    it('has _scope === "singleton"', () => {
      expect(HonoService._scope).toBe('SINGLETON');
    });

    it('resolves via Container', async () => {
      class TestModule extends HonoModule({ providers: [] }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      expect(service).toBeInstanceOf(HonoService);
      expect(service.hono).toBeInstanceOf(Hono);
    });

    it('empty module (no controllers) — onStart() works, .hono returns empty app', async () => {
      class TestModule extends HonoModule({ providers: [] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/'));
      expect(res.status).toBe(404);
    });

    it('.hono getter returns app even before container is set', async () => {
      const service = new HonoService();
      expect(service.hono).toBeInstanceOf(Hono);
      const res = await service.hono.fetch(new Request('http://localhost/any'));
      expect(res.status).toBe(404);
    });

    it('.hono getter is idempotent — same instance on repeated access', async () => {
      class TestModule extends HonoModule({ providers: [] }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      const app1 = service.hono;
      const app2 = service.hono;
      expect(app1).toBe(app2);
    });

    it('onStart returns void (not Promise)', async () => {
      class TestModule extends HonoModule({ providers: [] }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      const result = service.onStart(container);
      expect(result).toBeUndefined();
    });

    it('onStop returns void (not Promise)', async () => {
      const service = new HonoService();
      const result = service.onStop({} as Container);
      expect(result).toBeUndefined();
    });
  });

  describe('route registration', () => {
    it('single controller with one GET route — responds correctly', async () => {
      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json([{ id: 1 }]),
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([{ id: 1 }]);
    });

    it('controller with multiple routes', async () => {
      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json(['list']),
        });

        create = this.route({
          method: 'POST',
          path: '/',
          handler: async () => Response.json({ created: true }),
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      const listRes = await result.app.fetch(new Request('http://localhost/users'));
      expect(listRes.status).toBe(200);

      const postRes = await result.app.fetch(
        new Request('http://localhost/users', { method: 'POST' }),
      );
      expect(postRes.status).toBe(200);
      const body = await postRes.json();
      expect(body).toEqual({ created: true });
    });

    it('registers routes for all HTTP methods', async () => {
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      class MethodController extends Controller({ path: '/api' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: () => Response.json({ method: 'GET' }),
        });
        post = this.route({
          method: 'POST',
          path: '/',
          handler: () => Response.json({ method: 'POST' }),
        });
        put = this.route({
          method: 'PUT',
          path: '/',
          handler: () => Response.json({ method: 'PUT' }),
        });
        del = this.route({
          method: 'DELETE',
          path: '/',
          handler: () => Response.json({ method: 'DELETE' }),
        });
        patch = this.route({
          method: 'PATCH',
          path: '/',
          handler: () => Response.json({ method: 'PATCH' }),
        });
        head = this.route({
          method: 'HEAD',
          path: '/',
          handler: () => new Response(null, { status: 200 }),
        });
        options = this.route({
          method: 'OPTIONS',
          path: '/',
          handler: () => Response.json({ method: 'OPTIONS' }),
        });
      }
      class TestModule extends HonoModule({ providers: [MethodController] }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      for (const method of methods) {
        const res = await service.hono.fetch(new Request('http://localhost/api', { method }));
        expect(res.status).toBe(200);
        if (method !== 'HEAD') {
          const body = await res.json();
          expect(body).toEqual({ method });
        }
      }
    });

    it('controller with path params (/:id)', async () => {
      class UserController extends Controller({ path: '/users' }) {
        getById = this.route({
          method: 'GET',
          path: '/:id',
          handler: async (c) => {
            const id = c.req.param('id');
            return Response.json({ id });
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users/42'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ id: '42' });
    });

    it('multiple controllers — all routes registered', async () => {
      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => new Response('users', { status: 200 }),
        });
      }

      class ProductController extends Controller({ path: '/products' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => new Response('products', { status: 200 }),
        });
      }

      class TestModule extends HonoModule({ providers: [UserController, ProductController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      const usersRes = await result.app.fetch(new Request('http://localhost/users'));
      expect(usersRes.status).toBe(200);

      const productsRes = await result.app.fetch(new Request('http://localhost/products'));
      expect(productsRes.status).toBe(200);
    });

    it('controller with no routes — skipped gracefully', async () => {
      class EmptyController extends Controller({ path: '/empty' }) {}

      class TestModule extends HonoModule({ providers: [EmptyController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/empty'));
      expect(res.status).toBe(404);
    });
  });

  describe('request scope & context', () => {
    it('request scope middleware — different instances per request', async () => {
      class RequestCounter extends Injectable({ scope: SCOPE.REQUEST }) {
        static #counter = 0;
        readonly id = ++RequestCounter.#counter;
      }

      class UserController extends Controller({ path: '/users' }) {
        #container: Container | undefined;

        setContainer(c: Container) {
          this.#container = c;
        }

        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => {
            const counter = this.#container!.resolve(RequestCounter);
            return Response.json({ id: counter.id });
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController, RequestCounter] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const controller = container.resolve(UserController);
      controller.setContainer(container);

      const [res1, res2] = await Promise.all([
        result.app.fetch(new Request('http://localhost/users')),
        result.app.fetch(new Request('http://localhost/users')),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.id).not.toBe(body2.id);
    });

    it('RequestContext available inside handler', async () => {
      class UserController extends Controller({
        path: '/users',
        inject: [['ctx', HonoContext]],
      }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => {
            const ctx = this.inject.ctx.get();
            const url = ctx?.req.url ?? 'no-ctx';
            return Response.json({ url });
          },
        });
      }

      class TestModule extends HonoModule({ providers: [HonoContext, UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe('http://localhost/users');
    });

    it('RequestContext available in request-scoped provider onStart hook', async () => {
      let capturedContext: Context | undefined;

      class RequestScopedWithOnStart extends Injectable({
        scope: SCOPE.REQUEST,
        inject: [['ctx', HonoContext]],
      }) {
        onStart = () => {
          capturedContext = this.inject.ctx.get();
        };
      }

      class UserController extends Controller({ path: '/users' }) {
        #container: Container | undefined;

        setContainer(c: Container) {
          this.#container = c;
        }

        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => {
            this.#container!.resolve(RequestScopedWithOnStart);
            return Response.json({ ok: true });
          },
        });
      }

      class TestModule extends HonoModule({
        providers: [HonoContext, UserController, RequestScopedWithOnStart],
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const controller = container.resolve(UserController);
      controller.setContainer(container);

      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      expect(capturedContext).toBeDefined();
      expect(capturedContext?.req.url).toBe('http://localhost/users');
    });

    it('request scope cleanup when handler throws', async () => {
      let instanceCount = 0;

      class RequestScoped extends Injectable({ scope: SCOPE.REQUEST }) {
        readonly id = ++instanceCount;
      }

      class UserController extends Controller({ path: '/users' }) {
        #container: Container | undefined;

        setContainer(c: Container) {
          this.#container = c;
        }

        fail = this.route({
          method: 'GET',
          path: '/fail',
          handler: async () => {
            const _svc = this.#container!.resolve(RequestScoped);
            throw new Error('handler failed');
          },
        });

        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => {
            const _svc = this.#container!.resolve(RequestScoped);
            return Response.json({ id: _svc.id });
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController, RequestScoped] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const controller = container.resolve(UserController);
      controller.setContainer(container);

      // First request: handler throws after resolving the request-scoped service
      try {
        await result.app.fetch(new Request('http://localhost/users/fail'));
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('handler failed');
      }

      // Second request: should get a new instance (scope was cleaned up)
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(2);
    });
  });

  describe('error handling', () => {
    it('error in handler — re-thrown by errorHandler (plain Error)', async () => {
      class UserController extends Controller({ path: '/users' }) {
        fail = this.route({
          method: 'GET',
          path: '/fail',
          handler: async () => {
            throw new Error('something broke');
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      try {
        await result.app.fetch(new Request('http://localhost/users/fail'));
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('something broke');
      }
    });

    it('DIError in handler — caught by errorHandler → 500 JSON', async () => {
      class UserController extends Controller({ path: '/users' }) {
        fail = this.route({
          method: 'GET',
          path: '/di-fail',
          handler: async () => {
            throw new DIError('MISSING_PROVIDER', 'Service not found');
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users/di-fail'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe('MISSING_PROVIDER');
    });

    it('handles HTTPException from route handler', async () => {
      class ErrorController extends Controller({ path: '/error' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: () => {
            throw new HTTPException(403, { message: 'Forbidden' });
          },
        });
      }
      class TestModule extends HonoModule({ providers: [ErrorController] }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      const res = await service.hono.fetch(new Request('http://localhost/error'));
      expect(res.status).toBe(403);
    });

    it('handles HTTPException with 5xx status', async () => {
      class ErrorController extends Controller({ path: '/error' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: () => {
            throw new HTTPException(503, { message: 'Service Unavailable' });
          },
        });
      }
      class TestModule extends HonoModule({ providers: [ErrorController] }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      const res = await service.hono.fetch(new Request('http://localhost/error'));
      expect(res.status).toBe(503);
    });

    it('middleware that throws — error handler catches it', async () => {
      const throwingMiddleware: MiddlewareHandler = async () => {
        throw new HTTPException(500, { message: 'middleware crashed' });
      };
      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json({ users: [] }),
        });
      }
      class TestModule extends HonoModule({
        providers: [UserController],
        options: () => ({ middlewares: [throwingMiddleware] }),
      }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      const res = await service.hono.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(500);
    });
  });

  describe('dependency injection', () => {
    it('controller with injected deps receives them', async () => {
      class DbService extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly name = 'test-db';
      }

      class UserController extends Controller({ path: '/users', inject: [['db', DbService]] }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json({ db: this.inject.db.name }),
        });
      }

      class TestModule extends HonoModule({ providers: [DbService, UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.db).toBe('test-db');
    });

    it('imported module with controller deps — buildGraph walks imports', async () => {
      class DbService extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly name = 'imported-db';
      }

      class UserController extends Controller({ path: '/users', inject: [['db', DbService]] }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json({ db: this.inject.db.name }),
        });
      }

      class SharedModule extends Module({
        providers: [DbService],
        exports: [DbService],
      }) {}

      class TestModule extends HonoModule({
        providers: [UserController],
        imports: [SharedModule],
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.db).toBe('imported-db');
    });

    it('imported module with exported controller having deps in imported module providers', async () => {
      class LoggerService extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly tag = 'imported-logger';
      }

      class HealthController extends Controller({
        path: '/health',
        inject: [['logger', LoggerService]],
      }) {
        check = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json({ tag: this.inject.logger.tag }),
        });
      }

      class HealthModule extends Module({
        providers: [LoggerService, HealthController],
        exports: [HealthController],
      }) {}

      class TestModule extends HonoModule({ providers: [], imports: [HealthModule] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/health'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tag).toBe('imported-logger');
    });

    it('buildGraph handles provider with inject dep not in imported module', async () => {
      class ExternalDep extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly name = 'external';
      }

      class UserController extends Controller({ path: '/users', inject: [['dep', ExternalDep]] }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json({ name: this.inject.dep.name }),
        });
      }

      class FeatureModule extends Module({
        providers: [UserController],
        exports: [UserController],
      }) {}

      class TestModule extends HonoModule({ providers: [ExternalDep], imports: [FeatureModule] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('external');
    });

    it('deeply nested module imports (3 levels)', async () => {
      class DeepService extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly value = 'deep';
      }

      class DeepController extends Controller({ path: '/deep', inject: [['svc', DeepService]] }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json({ value: this.inject.svc.value }),
        });
      }

      class Level3Module extends Module({
        providers: [DeepService, DeepController],
        exports: [DeepController],
      }) {}

      class Level2Module extends Module({
        providers: [],
        imports: [Level3Module],
      }) {}

      class RootModule extends HonoModule({ providers: [], imports: [Level2Module] }) {}

      const result = await setupModule(RootModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/deep'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ value: 'deep' });
    });
  });

  describe('validation', () => {
    it('validate.json — valid body passes', async () => {
      const bodySchema = z.object({ name: z.string() });

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: bodySchema },
          handler: async (c) => {
            const data = c.req.valid('json');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Alice' }),
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: 'Alice' });
    });

    it('validate.json — invalid body → 400', async () => {
      const bodySchema = z.object({ name: z.string() });

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: bodySchema },
          handler: async (c) => {
            const data = c.req.valid('json');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 123 }),
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expectValidationFailed(body);
    });

    it('validate.query — valid passes', async () => {
      const querySchema = z.object({ page: z.coerce.number() });

      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          validate: { query: querySchema },
          handler: async (c) => {
            const data = c.req.valid('query');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users?page=2'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ page: 2 });
    });

    it('validate.query — invalid → 400', async () => {
      const querySchema = z.object({ page: z.coerce.number().min(1) });

      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          validate: { query: querySchema },
          handler: async (c) => {
            const data = c.req.valid('query');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users?page=abc'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expectValidationFailed(body);
    });

    it('validate.param — valid passes', async () => {
      const paramSchema = z.object({ id: z.string().uuid() });

      class UserController extends Controller({ path: '/users' }) {
        get = this.route({
          method: 'GET',
          path: '/:id',
          validate: { param: paramSchema },
          handler: async (c) => {
            const data = c.req.valid('param');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users/550e8400-e29b-41d4-a716-446655440000'),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('validate.param — invalid → 400', async () => {
      const paramSchema = z.object({ id: z.string().uuid() });

      class UserController extends Controller({ path: '/users' }) {
        get = this.route({
          method: 'GET',
          path: '/:id',
          validate: { param: paramSchema },
          handler: async (c) => {
            const data = c.req.valid('param');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users/not-a-uuid'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expectValidationFailed(body);
    });

    it('validate.header — valid headers pass', async () => {
      const headerSchema = z.object({ 'x-custom': z.string() });

      class UserController extends Controller({ path: '/users' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          validate: { header: headerSchema },
          handler: async (c) => {
            const data = c.req.valid('header');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users', {
          headers: { 'x-custom': 'hello' },
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body['x-custom']).toBe('hello');
    });

    it('validate.header — invalid headers → 400', async () => {
      const headerSchema = z.object({ 'x-custom': z.string() });

      class UserController extends Controller({ path: '/users' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          validate: { header: headerSchema },
          handler: async (c) => {
            const data = c.req.valid('header');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expectValidationFailed(body);
    });

    it('validate.form — valid form data passes', async () => {
      const formSchema = z.object({ name: z.string() });

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { form: formSchema },
          handler: async (c) => {
            const data = c.req.valid('form');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'name=Alice',
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: 'Alice' });
    });

    it('validate.form — invalid form data → 400', async () => {
      const formSchema = z.object({ name: z.string() });

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { form: formSchema },
          handler: async (c) => {
            const data = c.req.valid('form');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'age=30',
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expectValidationFailed(body);
    });

    it('validate.cookie — valid cookies pass', async () => {
      const cookieSchema = z.object({ session: z.string() });

      class UserController extends Controller({ path: '/users' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          validate: { cookie: cookieSchema },
          handler: async (c) => {
            const data = c.req.valid('cookie');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users', {
          headers: { Cookie: 'session=abc123' },
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.session).toBe('abc123');
    });

    it('validate.cookie — invalid cookies → 400', async () => {
      const cookieSchema = z.object({ session: z.string() });

      class UserController extends Controller({ path: '/users' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          validate: { cookie: cookieSchema },
          handler: async (c) => {
            const data = c.req.valid('cookie');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expectValidationFailed(body);
    });

    it('supports async validate returning Promise', async () => {
      const asyncSchema: StandardSchema<{ name: string }> = {
        '~standard': {
          version: 1 as const,
          vendor: 'test' as const,
          validate: async (value: unknown) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            if (
              typeof value === 'object' &&
              value !== null &&
              'name' in value &&
              typeof (value as Record<string, unknown>).name === 'string'
            ) {
              return { value: value as { name: string }, issues: undefined };
            }
            return {
              issues: [
                { message: 'Invalid', path: [] as readonly (PropertyKey | StandardPathSegment)[] },
              ],
            };
          },
        },
      };

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: asyncSchema },
          handler: async (c) => {
            const data = c.req.valid('json');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      const validRes = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Alice' }),
        }),
      );
      expect(validRes.status).toBe(200);
      const validBody = await validRes.json();
      expect(validBody).toEqual({ name: 'Alice' });

      const invalidRes = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ age: 30 }),
        }),
      );
      expect(invalidRes.status).toBe(400);
      const invalidBody = await invalidRes.json();
      expectValidationFailed(invalidBody);
    });

    it('validates multiple targets on same route', async () => {
      const jsonSchema = z.object({ name: z.string() });
      const querySchema = z.object({ page: z.coerce.number() });

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: jsonSchema, query: querySchema },
          handler: async (c) => {
            const data = c.req.valid('json');
            const query = c.req.valid('query');
            return Response.json({ data, query });
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      const validRes = await result.app.fetch(
        new Request('http://localhost/users?page=2', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Alice' }),
        }),
      );
      expect(validRes.status).toBe(200);

      const invalidQueryRes = await result.app.fetch(
        new Request('http://localhost/users?page=abc', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Alice' }),
        }),
      );
      expect(invalidQueryRes.status).toBe(400);
      const invalidQueryBody = await invalidQueryRes.json();
      expectValidationFailed(invalidQueryBody);

      const invalidJsonRes = await result.app.fetch(
        new Request('http://localhost/users?page=2', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 123 }),
        }),
      );
      expect(invalidJsonRes.status).toBe(400);
      const invalidJsonBody = await invalidJsonRes.json();
      expectValidationFailed(invalidJsonBody);
    });

    it('VALIDATE_TARGETS iteration order — json validates before query', async () => {
      const order: string[] = [];

      const jsonCapturingSchema: StandardSchema<{ name: string }> = {
        '~standard': {
          version: 1 as const,
          vendor: 'test' as const,
          validate: (): StandardResult<{ name: string }> => {
            order.push('json');
            return { value: { name: 'test' } };
          },
        },
      };

      const queryCapturingSchema: StandardSchema<{ page: number }> = {
        '~standard': {
          version: 1 as const,
          vendor: 'test' as const,
          validate: (): StandardResult<{ page: number }> => {
            order.push('query');
            return { value: { page: 1 } };
          },
        },
      };

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: jsonCapturingSchema, query: queryCapturingSchema },
          handler: async (c) => {
            const data = c.req.valid('json');
            const query = c.req.valid('query');
            return Response.json({ data, query });
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users?page=1', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'test' }),
        }),
      );
      expect(res.status).toBe(200);
      expect(order).toEqual(['json', 'query']);
    });

    it('route without validate — no validation, works directly', async () => {
      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => new Response('ok', { status: 200 }),
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('ok');
    });

    it('handles schema validate() throwing', async () => {
      const throwingSchema: StandardSchema = {
        '~standard': {
          version: 1 as const,
          vendor: 'test' as const,
          validate: () => {
            throw new Error('Schema exploded');
          },
        },
      };
      class ThrowController extends Controller({ path: '/throw' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: throwingSchema },
          handler: (c) => c.json({ ok: true }),
        });
      }
      class TestModule extends HonoModule({ providers: [ThrowController] }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      try {
        await service.hono.fetch(
          new Request('http://localhost/throw', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          }),
        );
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('Schema exploded');
      }
    });

    it('schema returning empty issues array treated as failure', async () => {
      const emptyIssuesSchema: StandardSchema = {
        '~standard': {
          version: 1 as const,
          vendor: 'test' as const,
          validate: () => ({ issues: [] as const }),
        },
      };
      class EmptyIssuesController extends Controller({ path: '/empty' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: emptyIssuesSchema },
          handler: (c) => c.json({ ok: true }),
        });
      }
      class TestModule extends HonoModule({ providers: [EmptyIssuesController] }) {}
      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/empty', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({
        error: VALIDATION_ERROR_MESSAGE,
        issues: [],
      });
    });

    it('RequestContext is undefined inside validation middleware', async () => {
      const NOT_SET = Symbol('NOT_SET');
      let capturedContext: Context | undefined | typeof NOT_SET = NOT_SET;

      const capturingSchema: StandardSchema<{ name: string }> = {
        '~standard': {
          version: 1 as const,
          vendor: 'test' as const,
          validate: (): StandardResult<{ name: string }> => {
            const ctxInstance = new HonoContext();
            capturedContext = ctxInstance.get();
            return { value: { name: 'captured' } };
          },
        },
      };

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: capturingSchema },
          handler: async (c) => {
            const data = c.req.valid('json');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'test' }),
        }),
      );
      expect(res.status).toBe(200);
      expect(capturedContext).toBeUndefined();
    });

    it('validation throwing DIError — caught by errorHandler → 500', async () => {
      const diErrorSchema: StandardSchema = {
        '~standard': {
          version: 1 as const,
          vendor: 'test' as const,
          validate: () => {
            throw new DIError('SCOPE_VIOLATION', 'test');
          },
        },
      };

      class ThrowController extends Controller({ path: '/throw' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: diErrorSchema },
          handler: (c) => c.json({ ok: true }),
        });
      }

      class TestModule extends HonoModule({ providers: [ThrowController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/throw', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: { code: 'SCOPE_VIOLATION', message: 'test' } });
    });

    it('middleware + validation execution order', async () => {
      const order: string[] = [];

      const capturingSchema: StandardSchema<{ name: string }> = {
        '~standard': {
          version: 1 as const,
          vendor: 'test' as const,
          validate: (): StandardResult<{ name: string }> => {
            order.push('validation');
            return { value: { name: 'test' } };
          },
        },
      };

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: capturingSchema },
          handler: async (c) => {
            const data = c.req.valid('json');
            return Response.json(data);
          },
        });
      }

      const optionsFactory: HonoModuleOptionsFactory = () => ({
        middlewares: [
          async (_c: Context, next: () => Promise<void>) => {
            order.push('middleware');
            await next();
          },
        ],
      });

      class TestModule extends HonoModule({
        providers: [UserController],
        options: optionsFactory,
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'test' }),
        }),
      );
      expect(res.status).toBe(200);
      expect(order).toEqual(['middleware', 'validation']);
    });

    it('native Zod v4 Standard Schema — no adapter needed', async () => {
      const bodySchema = z.object({ name: z.string(), email: z.string().email() });

      class UserController extends Controller({ path: '/users' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: { json: bodySchema },
          handler: async (c) => {
            const data = c.req.valid('json');
            return Response.json(data);
          },
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      // Valid body — native Zod v4 schema passes validation
      const validRes = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
        }),
      );
      expect(validRes.status).toBe(200);
      const validBody = await validRes.json();
      expect(validBody).toEqual({ name: 'Alice', email: 'alice@example.com' });

      // Invalid body — native Zod v4 schema rejects bad data
      const invalidRes = await result.app.fetch(
        new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 123, email: 'not-an-email' }),
        }),
      );
      expect(invalidRes.status).toBe(400);
      const invalidBody = await invalidRes.json();
      expectValidationFailed(invalidBody);
    });
  });

  describe('options factory', () => {
    it('middlewares applied', async () => {
      const middlewareOrder: string[] = [];

      class UserController extends Controller({ path: '/users' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json({ ok: true }),
        });
      }

      const optionsFactory: HonoModuleOptionsFactory = (_resolve) => ({
        middlewares: [
          async (_c: Context, next: () => Promise<void>) => {
            middlewareOrder.push('mw1');
            await next();
          },
          async (_c: Context, next: () => Promise<void>) => {
            middlewareOrder.push('mw2');
            await next();
          },
        ],
      });

      class TestModule extends HonoModule({
        providers: [UserController],
        options: optionsFactory,
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      expect(middlewareOrder).toEqual(['mw1', 'mw2']);
    });

    it('resolve function works', async () => {
      class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly value = 'from-config';
      }

      let resolvedViaFactory = false;

      class TestModule extends HonoModule({
        providers: [ConfigService],
        options: (resolve) => {
          const config = resolve(ConfigService);
          if (config instanceof ConfigService && config.value === 'from-config') {
            resolvedViaFactory = true;
          }
          return {};
        },
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      expect(resolvedViaFactory).toBe(true);
    });

    it('throws DIError when options factory resolve fails', async () => {
      class MissingService extends Injectable({ scope: SCOPE.SINGLETON }) {}
      class TestModule extends HonoModule({
        providers: [],
        options: (resolve) => ({
          middlewares: [],
          port: 3000,
          host: 'localhost',
          someOption: resolve(MissingService),
        }),
      }) {}
      container = new Container(TestModule);
      try {
        await container.start();
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(DIError);
        expect((e as DIError).code).toBe('MISSING_PROVIDER');
      }
    });

    it('throws when options factory itself throws', async () => {
      class TestModule extends HonoModule({
        providers: [],
        options: () => {
          throw new Error('Options factory crashed');
        },
      }) {}
      container = new Container(TestModule);
      try {
        await container.start();
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('Options factory crashed');
      }
    });

    it('middleware short-circuits — handler not called', async () => {
      let handlerCalled = false;

      class UserController extends Controller({ path: '/users' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => {
            handlerCalled = true;
            return Response.json({ ok: true });
          },
        });
      }

      const optionsFactory: HonoModuleOptionsFactory = () => ({
        middlewares: [
          async (_c: Context, _next: () => Promise<void>) => {
            return _c.json({ blocked: true }, 403);
          },
        ],
      });

      class TestModule extends HonoModule({
        providers: [UserController],
        options: optionsFactory,
      }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ blocked: true });
      expect(handlerCalled).toBe(false);
    });

    it('module with middlewares but no controllers — middleware still applied', async () => {
      let middlewareCalled = false;
      const trackingMiddleware: MiddlewareHandler = async (c, next) => {
        middlewareCalled = true;
        return next();
      };
      class TestModule extends HonoModule({
        providers: [],
        options: () => ({ middlewares: [trackingMiddleware] }),
      }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      const res = await service.hono.fetch(new Request('http://localhost/anything'));
      expect(middlewareCalled).toBe(true);
      expect(res.status).toBe(404);
    });
  });

  describe('lifecycle', () => {
    it('onStop resets app state', async () => {
      class UserController extends Controller({ path: '/users' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: async () => Response.json({ users: [] }),
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      const resBefore = await service.hono.fetch(new Request('http://localhost/users'));
      expect(resBefore.status).toBe(200);
      await container.stop();
      expect(service.hono).toBeInstanceOf(Hono);
      const resAfter = await service.hono.fetch(new Request('http://localhost/users'));
      expect(resAfter.status).toBe(404);
    });

    it('reads port and host from module options', async () => {
      const TestModule = HonoModule({
        providers: [],
        options: (_resolve) => ({
          port: 3000,
          host: '0.0.0.0',
        }),
      });
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      expect(service.hono).toBeInstanceOf(Hono);
      expect(service.port).toBe(3000);
      expect(service.host).toBe('0.0.0.0');
    });

    it('port and host default to undefined', async () => {
      const TestModule = HonoModule({ providers: [] });
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      expect(service.port).toBeUndefined();
      expect(service.host).toBeUndefined();
    });

    it('onStop resets port and host', async () => {
      const TestModule = HonoModule({
        providers: [],
        options: () => ({ port: 3000, host: '0.0.0.0' }),
      });
      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      expect(service.hono).toBeInstanceOf(Hono);
      expect(service.port).toBe(3000);
      expect(service.host).toBe('0.0.0.0');
      await container.stop();
      expect(service.port).toBeUndefined();
      expect(service.host).toBeUndefined();
    });

    it('plain Module without _honoOptions — #readOptions returns undefined, routes still work', async () => {
      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => new Response('ok', { status: 200 }),
        });
      }

      class TestModule extends Module({
        providers: [HonoService, UserController],
      }) {}

      container = new Container(TestModule);
      await container.start();
      const service = container.resolve(HonoService);
      const res = await service.hono.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      expect(service.port).toBeUndefined();
      expect(service.host).toBeUndefined();
    });

    it('HonoModule as nested import — options still applied', async () => {
      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => new Response('ok', { status: 200 }),
        });
      }

      class UserModule extends Module({
        providers: [UserController],
        exports: [UserController],
      }) {}

      class HttpModule extends HonoModule({
        options: () => ({ port: 3000, host: '0.0.0.0' }),
      }) {}

      class AppModule extends Module({
        imports: [HttpModule, UserModule],
      }) {}

      container = new Container(AppModule);
      await container.start();
      const service = container.resolve(HonoService);
      expect(service.hono).toBeInstanceOf(Hono);
      expect(service.port).toBe(3000);
      expect(service.host).toBe('0.0.0.0');
      const res = await service.hono.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
    });

    it('HonoModule as nested import — middlewares still applied', async () => {
      const middlewareOrder: string[] = [];
      const trackingMiddleware: MiddlewareHandler = async (_c, next) => {
        middlewareOrder.push('global');
        await next();
      };

      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => new Response('ok', { status: 200 }),
        });
      }

      class UserModule extends Module({
        providers: [UserController],
        exports: [UserController],
      }) {}

      class HttpModule extends HonoModule({
        options: () => ({ middlewares: [trackingMiddleware] }),
      }) {}

      class AppModule extends Module({
        imports: [HttpModule, UserModule],
      }) {}

      container = new Container(AppModule);
      await container.start();
      const service = container.resolve(HonoService);
      expect(service.hono).toBeInstanceOf(Hono);
      const res = await service.hono.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
      expect(middlewareOrder).toEqual(['global']);
    });
  });

  describe('edge cases', () => {
    it('controller with null property — getRouteProperties skips null', async () => {
      class UserController extends Controller({ path: '/users' }) {
        nullable: unknown = null;

        list = this.route({
          method: 'GET',
          path: '/',
          handler: async () => new Response('ok', { status: 200 }),
        });
      }

      class TestModule extends HonoModule({ providers: [UserController] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/users'));
      expect(res.status).toBe(200);
    });

    it('diamond imports — cycle detection skips already-collected module', async () => {
      class SharedService extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly name = 'shared';
      }

      class ModA extends Module({
        providers: [SharedService],
        exports: [SharedService],
      }) {}

      class ModB extends Module({
        providers: [],
        imports: [ModA],
      }) {}

      class TestModule extends HonoModule({ providers: [], imports: [ModA, ModB] }) {}

      const result = await setupModule(TestModule);
      container = result.container;
      const res = await result.app.fetch(new Request('http://localhost/'));
      expect(res.status).toBe(404);
    });
  });
});
