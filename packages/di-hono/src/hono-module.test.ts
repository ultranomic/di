import { type InjectableClass, Container, Injectable, Module, SCOPE } from '@ultranomic/di';
import { type Context, Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';
import { Controller } from './controller.ts';
import { HonoModule } from './hono-module.ts';
import { HonoService } from './hono-service.ts';
import { expectValidationFailed, setupModule } from './test-helpers.ts';
import type { HonoModuleOptionsFactory } from './types.ts';

let container: Container;

afterEach(async () => {
  if (container) await container.stop();
});

describe('HonoModule', () => {
  it('returns class with _isHonoModule === true', () => {
    const mod = HonoModule({ providers: [] });
    expect(mod._isHonoModule).toBe(true);
  });

  it('auto-adds HonoService to _providers', () => {
    const mod = HonoModule({ providers: [] });
    expect(mod._providers).toContain(HonoService);
  });

  it('HonoModule with custom providers — HonoService still auto-added', () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    const mod = HonoModule({ providers: [MyService] });
    expect(mod._providers).toContain(HonoService);
    expect(mod._providers).toContain(MyService);
  });

  it('deduplicates HonoService if already in providers', () => {
    const mod = HonoModule({ providers: [HonoService] });
    const honoCount = mod._providers.filter((p) => p === HonoService).length;
    expect(honoCount).toBe(1);
  });

  it('auto-exports HonoService', () => {
    const mod = HonoModule({ providers: [] });
    expect(mod._exports).toContain(HonoService);
  });

  it('deduplicates HonoService if already in exports', () => {
    // @ts-expect-error — intentionally testing runtime dedup of auto-included HonoService
    const mod = HonoModule({ providers: [], exports: [HonoService] });
    const honoCount = mod._exports.filter((p) => p === HonoService).length;
    expect(honoCount).toBe(1);
  });

  it('is a valid ModuleClass (has _providers, _exports, _imports)', () => {
    const mod = HonoModule({ providers: [] });
    expect('_providers' in mod).toBe(true);
    expect('_exports' in mod).toBe(true);
    expect('_imports' in mod).toBe(true);
    expect(Array.isArray(mod._providers)).toBe(true);
    expect(Array.isArray(mod._exports)).toBe(true);
    expect(Array.isArray(mod._imports)).toBe(true);
  });

  it('passes exports to Module', () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    const mod = HonoModule({ providers: [MyService], exports: [MyService] });
    expect(mod._exports).toContain(MyService);
  });

  it('passes imports to Module', () => {
    class SharedService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    const SharedModule = Module({
      providers: [SharedService],
      exports: [SharedService],
    });
    const mod = HonoModule({ providers: [], imports: [SharedModule] });
    expect(mod._imports).toContain(SharedModule);
  });

  it('re-exports imported ModuleClass via exports', () => {
    class SharedService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    const SharedModule = Module({
      providers: [SharedService],
      exports: [SharedService],
    });
    const mod = HonoModule({ providers: [], imports: [SharedModule], exports: [SharedModule] });
    expect(mod._exports).toContain(SharedModule);
    expect(mod._exports).toContain(HonoService);
  });

  it('deduplicates HonoService when importing HonoModule', () => {
    const SharedHonoModule = HonoModule({ providers: [] });
    const mod = HonoModule({ providers: [], imports: [SharedHonoModule] });
    const honoCount = mod._providers.filter((p) => p === HonoService).length;
    expect(honoCount).toBe(1);
    expect(mod._exports).toContain(HonoService);
  });

  it('_honoOptions stores factory function', () => {
    const factory: HonoModuleOptionsFactory = () => ({});
    const mod = HonoModule({ providers: [], options: factory });
    expect(mod._honoOptions).toBe(factory);
  });

  it('default _honoOptions returns empty object', () => {
    const mod = HonoModule({ providers: [] });
    const result = mod._honoOptions(<T>(_cls: InjectableClass<T>): T => ({}) as T);
    expect(result).toEqual({});
  });

  it('Container.start() with HonoModule → HonoService.onStart() called', async () => {
    class TestModule extends HonoModule({ providers: [] }) {}
    const result = await setupModule(TestModule);
    container = result.container;
    expect(result.app).toBeInstanceOf(Hono);
  });

  it('full integration: HonoModule + Controller with route → fetch → response', async () => {
    class TestController extends Controller({ path: '/test' }) {
      list = this.route({
        method: 'GET',
        path: '/',
        handler: async () => Response.json({ ok: true }),
      });
    }

    class TestModule extends HonoModule({ providers: [TestController] }) {}
    const result = await setupModule(TestModule);
    container = result.container;

    const res = await result.app.fetch(new Request('http://localhost/test'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('full integration: Controller with validate → POST valid body → 200, invalid → 400', async () => {
    const bodySchema = z.object({ name: z.string() });

    class TestController extends Controller({ path: '/test' }) {
      create = this.route({
        method: 'POST',
        path: '/',
        validate: { json: bodySchema },
        handler: async (c: Context) => {
          // @ts-expect-error — validate narrows valid() but type inference doesn't propagate in this context
          const data = c.req.valid('json');
          return Response.json({ created: true, data });
        },
      });
    }

    class TestModule extends HonoModule({ providers: [TestController] }) {}
    const result = await setupModule(TestModule);
    container = result.container;

    // Valid POST
    const validRes = await result.app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      }),
    );
    expect(validRes.status).toBe(200);
    const validBody = await validRes.json();
    expect(validBody.created).toBe(true);
    expect(validBody.data).toEqual({ name: 'Alice' });

    // Invalid POST
    const invalidRes = await result.app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 123 }),
      }),
    );
    expect(invalidRes.status).toBe(400);
    const invalidBody = await invalidRes.json();
    expectValidationFailed(invalidBody);
  });

  it('HonoModule() with no args — auto-adds HonoService, defaults work', () => {
    const mod = HonoModule();
    expect(mod._isHonoModule).toBe(true);
    expect(mod._providers).toContain(HonoService);
    expect(mod._exports).toContain(HonoService);
    expect(mod._imports).toEqual([]);
  });

  it('full integration: multiple controllers → all routes work', async () => {
    class UserController extends Controller({ path: '/users' }) {
      list = this.route({
        method: 'GET',
        path: '/',
        handler: async () => Response.json({ users: true }),
      });
    }

    class ProductController extends Controller({ path: '/products' }) {
      list = this.route({
        method: 'GET',
        path: '/',
        handler: async () => Response.json({ products: true }),
      });
    }

    class TestModule extends HonoModule({
      providers: [UserController, ProductController],
    }) {}
    const result = await setupModule(TestModule);
    container = result.container;

    const usersRes = await result.app.fetch(new Request('http://localhost/users'));
    expect(usersRes.status).toBe(200);
    const usersBody = await usersRes.json();
    expect(usersBody).toEqual({ users: true });

    const productsRes = await result.app.fetch(new Request('http://localhost/products'));
    expect(productsRes.status).toBe(200);
    const productsBody = await productsRes.json();
    expect(productsBody).toEqual({ products: true });
  });
});
