import { Container, DIError, DI_ERROR_CODE, Injectable, SCOPE } from '@ultranomic/di';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { Controller } from './controller.ts';
import { HonoModule } from './hono-module.ts';
import { HonoService } from './hono-service.ts';
import { setupModule } from './test-helpers.ts';

let container: Container;

afterEach(async () => {
  if (container) await container.stop();
});

describe('Cross-package error propagation', () => {
  describe('DIError propagation through Hono', () => {
    it('propagates errors thrown in route handlers', async () => {
      class TestController extends Controller({ path: '/test' }) {
        throwError = this.route({
          method: 'GET',
          path: '/error',
          handler: () => {
            throw new DIError(DI_ERROR_CODE.MISSING_PROVIDER, 'Provider not found');
          },
        });
      }

      class TestModule extends HonoModule({
        providers: [TestController],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      container = new Container(TestModule);
      await container.start();
      const app = container.resolve(HonoService).hono;

      const res = await app.fetch(new Request('http://localhost/test/error'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe('MISSING_PROVIDER');
      expect(body.error.message).toBe('Provider not found');
    });

    it('propagates SCOPE_VIOLATION error from route handler', async () => {
      class TestController extends Controller({ path: '/test' }) {
        throwError = this.route({
          method: 'GET',
          path: '/error',
          handler: () => {
            throw new DIError(DI_ERROR_CODE.SCOPE_VIOLATION, 'Scope violation');
          },
        });
      }

      class TestModule extends HonoModule({
        providers: [TestController],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      container = new Container(TestModule);
      await container.start();
      const app = container.resolve(HonoService).hono;

      const res = await app.fetch(new Request('http://localhost/test/error'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe('SCOPE_VIOLATION');
    });
  });

  describe('Service error propagation', () => {
    it('propagates errors from service methods', async () => {
      class FailingService extends Injectable({ scope: SCOPE.SINGLETON }) {
        public getValue() {
          throw new DIError(DI_ERROR_CODE.UNKNOWN_SCOPE, 'Unknown scope');
        }
      }

      class TestController extends Controller({
        path: '/test',
        inject: [['service', FailingService]],
      }) {
        getValue = this.route({
          method: 'GET',
          path: '/',
          handler: (c) => c.json({ value: this.inject.service.getValue() }),
        });
      }

      class TestModule extends HonoModule({
        providers: [FailingService, TestController],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      const res = await result.app.fetch(new Request('http://localhost/test'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe('UNKNOWN_SCOPE');
    });
  });

  describe('Validation error propagation', () => {
    it('propagates validation errors from Hono middleware', async () => {
      class TestController extends Controller({ path: '/test' }) {
        createUser = this.route({
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

      class TestModule extends HonoModule({
        providers: [TestController],
        options: () => ({ port: 0, host: "0.0.0.0" }),

      }) {}

      const result = await setupModule(TestModule);
      container = result.container;

      const res = await result.app.fetch(
        new Request('http://localhost/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invalid: true }),
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Validation failed');
      expect(body.issues).toBeDefined();
    });
  });
});
