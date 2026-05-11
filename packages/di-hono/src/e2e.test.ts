import { Container, Injectable, Module, SCOPE } from '@ultranomic/di';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { Controller } from './controller.ts';
import { HonoModule } from './hono-module.ts';
import { HonoService } from './hono-service.ts';
import { setupModule } from './test-helpers.ts';

let container: Container;

afterEach(async () => {
  if (container) await container.stop();
});

describe('End-to-end HTTP lifecycle', () => {
  describe('Full lifecycle', () => {
    it('define modules → start container → make requests → stop container', async () => {
      class UserService extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly #users = [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' },
        ];

        list() {
          return this.#users;
        }

        getById(id: string) {
          return this.#users.find((u) => u.id === id);
        }
      }

      class UserController extends Controller({
        path: '/users',
        inject: [['userService', UserService]],
      }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: (c) => c.json(this.inject.userService.list()),
        });

        getById = this.route({
          method: 'GET',
          path: '/:id',
          handler: (c) => {
            const user = this.inject.userService.getById(c.req.param('id'));
            if (!user) return c.json({ error: 'Not found' }, 404);
            return c.json(user);
          },
        });
      }

      class UserModule extends Module({
        providers: [UserService, UserController],
        exports: [UserController],
      }) {}

      class AppModule extends HonoModule({
        imports: [UserModule],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      container = new Container(AppModule);
      await container.start();
      const app = container.resolve(HonoService).hono;

      const listRes = await app.fetch(new Request('http://localhost/users'));
      expect(listRes.status).toBe(200);
      const users = await listRes.json();
      expect(users).toHaveLength(2);

      const userRes = await app.fetch(new Request('http://localhost/users/1'));
      expect(userRes.status).toBe(200);
      const user = await userRes.json();
      expect(user).toEqual({ id: '1', name: 'Alice' });

      const notFoundRes = await app.fetch(new Request('http://localhost/users/999'));
      expect(notFoundRes.status).toBe(404);

      await container.stop();
    });
  });

  describe('Request scope isolation', () => {
    it('different requests get different request-scoped instances', async () => {
      class RequestId extends Injectable({ scope: SCOPE.REQUEST }) {
        static #counter = 0;
        readonly id = ++RequestId.#counter;
      }

      class TestController extends Controller({ path: '/test' }) {
        #container: Container | undefined;

        setContainer(c: Container) {
          this.#container = c;
        }

        getId = this.route({
          method: 'GET',
          path: '/',
          handler: async () => {
            const requestId = this.#container!.resolve(RequestId);
            return Response.json({ id: requestId.id });
          },
        });
      }

      class AppModule extends HonoModule({
        providers: [RequestId, TestController],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      const result = await setupModule(AppModule);
      container = result.container;
      const controller = container.resolve(TestController);
      controller.setContainer(container);

      const [res1, res2] = await Promise.all([
        result.app.fetch(new Request('http://localhost/test')),
        result.app.fetch(new Request('http://localhost/test')),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.id).not.toBe(body2.id);
    });
  });

  describe('Multiple controllers', () => {
    it('routes from multiple controllers are all accessible', async () => {
      class UserController extends Controller({ path: '/users' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: (c) => c.json({ type: 'users' }),
        });
      }

      class ProductController extends Controller({ path: '/products' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: (c) => c.json({ type: 'products' }),
        });
      }

      class OrderController extends Controller({ path: '/orders' }) {
        list = this.route({
          method: 'GET',
          path: '/',
          handler: (c) => c.json({ type: 'orders' }),
        });
      }

      class AppModule extends HonoModule({
        providers: [UserController, ProductController, OrderController],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      container = new Container(AppModule);
      await container.start();
      const app = container.resolve(HonoService).hono;

      const usersRes = await app.fetch(new Request('http://localhost/users'));
      expect(usersRes.status).toBe(200);
      expect(await usersRes.json()).toEqual({ type: 'users' });

      const productsRes = await app.fetch(new Request('http://localhost/products'));
      expect(productsRes.status).toBe(200);
      expect(await productsRes.json()).toEqual({ type: 'products' });

      const ordersRes = await app.fetch(new Request('http://localhost/orders'));
      expect(ordersRes.status).toBe(200);
      expect(await ordersRes.json()).toEqual({ type: 'orders' });
    });
  });

  describe('Validation', () => {
    it('validates request body and returns 400 on failure', async () => {
      class TestController extends Controller({ path: '/test' }) {
        create = this.route({
          method: 'POST',
          path: '/',
          validate: {
            json: {
              '~standard': {
                version: 1 as const,
                vendor: 'test' as const,
                validate: (value: unknown) => {
                  if (typeof value !== 'object' || value === null) {
                    return { issues: [{ message: 'Expected object' }] };
                  }
                  const obj = value as Record<string, unknown>;
                  if (!obj.name || typeof obj.name !== 'string') {
                    return { issues: [{ message: 'Name is required' }] };
                  }
                  return { value: obj };
                },
              },
            },
          },
          handler: (c) => c.json({ success: true }),
        });
      }

      class AppModule extends HonoModule({
        providers: [TestController],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      container = new Container(AppModule);
      await container.start();
      const app = container.resolve(HonoService).hono;

      const invalidRes = await app.fetch(
        new Request('http://localhost/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invalid: true }),
        }),
      );
      expect(invalidRes.status).toBe(400);

      const validRes = await app.fetch(
        new Request('http://localhost/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Alice' }),
        }),
      );
      expect(validRes.status).toBe(200);
    });
  });

  describe('Request context access', () => {
    it('can access Hono context from within request scope', async () => {
      class TestController extends Controller({ path: '/test' }) {
        getHeaders = this.route({
          method: 'GET',
          path: '/',
          handler: (c) => {
            const contentType = c.req.header('content-type') ?? 'unknown';
            return c.json({ contentType });
          },
        });
      }

      class AppModule extends HonoModule({
        providers: [TestController],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      container = new Container(AppModule);
      await container.start();
      const app = container.resolve(HonoService).hono;

      const res = await app.fetch(
        new Request('http://localhost/test', {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.contentType).toBe('application/json');
    });
  });

  describe('HTTP methods', () => {
    it('supports all HTTP methods', async () => {
      class TestController extends Controller({ path: '/test' }) {
        get = this.route({
          method: 'GET',
          path: '/',
          handler: (c) => c.json({ method: 'GET' }),
        });

        post = this.route({
          method: 'POST',
          path: '/',
          handler: (c) => c.json({ method: 'POST' }),
        });

        put = this.route({
          method: 'PUT',
          path: '/',
          handler: (c) => c.json({ method: 'PUT' }),
        });

        del = this.route({
          method: 'DELETE',
          path: '/',
          handler: (c) => c.json({ method: 'DELETE' }),
        });

        patch = this.route({
          method: 'PATCH',
          path: '/',
          handler: (c) => c.json({ method: 'PATCH' }),
        });
      }

      class AppModule extends HonoModule({
        providers: [TestController],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      container = new Container(AppModule);
      await container.start();
      const app = container.resolve(HonoService).hono;

      const getRes = await app.fetch(new Request('http://localhost/test'));
      expect(await getRes.json()).toEqual({ method: 'GET' });

      const postRes = await app.fetch(new Request('http://localhost/test', { method: 'POST' }));
      expect(await postRes.json()).toEqual({ method: 'POST' });

      const putRes = await app.fetch(new Request('http://localhost/test', { method: 'PUT' }));
      expect(await putRes.json()).toEqual({ method: 'PUT' });

      const deleteRes = await app.fetch(new Request('http://localhost/test', { method: 'DELETE' }));
      expect(await deleteRes.json()).toEqual({ method: 'DELETE' });

      const patchRes = await app.fetch(new Request('http://localhost/test', { method: 'PATCH' }));
      expect(await patchRes.json()).toEqual({ method: 'PATCH' });
    });
  });
});
