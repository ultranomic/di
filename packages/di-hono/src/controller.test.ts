import { Container, Injectable, Module, SCOPE } from '@ultranomic/di';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';
import { Controller } from './controller.ts';

import type { StandardResult, StandardSchema, ValidateTargets } from './types.ts';

let container: Container;

afterEach(async () => {
  if (container) await container.stop();
});

describe('Controller mixin', () => {
  it('returns class with _scope === "singleton"', () => {
    const BaseController = Controller({ path: '/test' });
    expect(BaseController._scope).toBe('SINGLETON');
  });

  it('sets _path static from config', () => {
    const BaseController = Controller({ path: '/users' });
    expect(BaseController._path).toBe('/users');
  });

  it('defaults _inject to empty array', () => {
    const BaseController = Controller({ path: '/test' });
    expect(BaseController._inject).toEqual([]);
  });

  it('passes custom inject entries to Injectable', () => {
    class DepService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    const BaseController = Controller({ path: '/test', inject: [['dep', DepService]] });
    expect(BaseController._inject).toEqual([DepService]);
  });

  describe('route() method', () => {
    it('returns object with _isRoute: true', () => {
      class TestController extends Controller({ path: '/test' }) {
        getIndex = this.route({
          method: 'GET',
          path: '/',
          handler: () => new Response('ok'),
        });
      }

      const instance = new TestController();
      expect(instance.getIndex._isRoute).toBe(true);
    });

    it('preserves method and path', () => {
      class TestController extends Controller({ path: '/test' }) {
        getUsers = this.route({
          method: 'GET',
          path: '/users',
          handler: () => new Response('ok'),
        });

        createUser = this.route({
          method: 'POST',
          path: '/users',
          handler: () => new Response('created'),
        });
      }

      const instance = new TestController();
      expect(instance.getUsers.method).toBe('GET');
      expect(instance.getUsers.path).toBe('/users');
      expect(instance.createUser.method).toBe('POST');
      expect(instance.createUser.path).toBe('/users');
    });

    it('preserves validate field when provided', () => {
      const bodySchema: StandardSchema<string> = {
        '~standard': {
          version: 1 as const,
          vendor: 'test' as const,
          validate(value: unknown): StandardResult<string> {
            if (typeof value === 'string') {
              return { value };
            }
            return { issues: [{ message: 'Expected string' }] };
          },
        },
      };

      const validate: ValidateTargets = { json: bodySchema };

      class TestController extends Controller({ path: '/test' }) {
        createUser = this.route({
          method: 'POST',
          path: '/users',
          validate,
          handler: () => new Response('created'),
        });
      }

      const instance = new TestController();
      expect(instance.createUser.validate).toBe(validate);
      expect(instance.createUser.validate?.json).toBe(bodySchema);
    });

    it('works without validate (no validate on result)', () => {
      class TestController extends Controller({ path: '/test' }) {
        getIndex = this.route({
          method: 'GET',
          path: '/',
          handler: () => new Response('ok'),
        });
      }

      const instance = new TestController();
      expect(instance.getIndex.validate).toBeUndefined();
    });

    it('preserves handler function', () => {
      const handler = () => new Response('ok');

      class TestController extends Controller({ path: '/test' }) {
        getIndex = this.route({
          method: 'GET',
          path: '/',
          handler,
        });
      }

      const instance = new TestController();
      expect(instance.getIndex.handler).toBe(handler);
    });
  });

  describe('integration with Container', () => {
    it('resolves controller instance via Container', async () => {
      class TestController extends Controller({ path: '/test' }) {}

      class TestModule extends Module({
        providers: [TestController],
        exports: [TestController],
      }) {}

      container = new Container(TestModule);
      await container.start();
      const ctrl = container.resolve(TestController);
      expect(ctrl).toBeInstanceOf(TestController);
    });

    it('resolves controller with injected deps', async () => {
      class DepService extends Injectable({ scope: SCOPE.SINGLETON }) {
        getValue() {
          return 42;
        }
      }

      class TestController extends Controller({
        path: '/test',
        inject: [['dep', DepService]],
      }) {
        getDepValue() {
          return this.inject.dep.getValue();
        }
      }

      class TestModule extends Module({
        providers: [DepService, TestController],
        exports: [TestController],
      }) {}

      container = new Container(TestModule);
      await container.start();
      const ctrl = container.resolve(TestController);
      expect(ctrl.getDepValue()).toBe(42);
    });

    it('instance route fields have _isRoute tag', async () => {
      class TestController extends Controller({ path: '/test' }) {
        getUsers = this.route({
          method: 'GET',
          path: '/',
          handler: () => new Response('ok'),
        });

        createUser = this.route({
          method: 'POST',
          path: '/',
          handler: () => new Response('created'),
        });
      }

      class TestModule extends Module({
        providers: [TestController],
        exports: [TestController],
      }) {}

      container = new Container(TestModule);
      await container.start();
      const ctrl = container.resolve(TestController);
      expect(ctrl.getUsers._isRoute).toBe(true);
      expect(ctrl.createUser._isRoute).toBe(true);
      expect(ctrl.getUsers.method).toBe('GET');
      expect(ctrl.createUser.method).toBe('POST');
    });
  });

  describe('multiple inject dependencies', () => {
    it('receives both deps in constructor in correct order', async () => {
      class DepA extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly tag = 'A';
      }

      class DepB extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly tag = 'B';
      }

      class TestController extends Controller({
        path: '/test',
        inject: [
          ['depA', DepA],
          ['depB', DepB],
        ],
      }) {
        getTags() {
          return [this.inject.depA.tag, this.inject.depB.tag];
        }
      }

      class TestModule extends Module({
        providers: [DepA, DepB, TestController],
        exports: [TestController],
      }) {}

      container = new Container(TestModule);
      await container.start();
      const ctrl = container.resolve(TestController);
      expect(ctrl.getTags()).toEqual(['A', 'B']);
    });
  });

  describe('zod schema validation', () => {
    it('route with zod-based validate schema', async () => {
      const userSchema = z.object({ name: z.string() });
      const validate: ValidateTargets = { json: userSchema };

      class TestController extends Controller({ path: '/users' }) {
        createUser = this.route({
          method: 'POST',
          path: '/',
          validate,
          handler: () => new Response('created'),
        });
      }

      const instance = new TestController();
      expect(instance.createUser.validate?.json).toBe(userSchema);

      const validResult = await userSchema['~standard'].validate({ name: 'Alice' });
      if (validResult.issues) {
        expect.unreachable('Should not have issues for valid input');
      } else {
        expect(validResult.value).toEqual({ name: 'Alice' });
      }

      const invalidResult = await userSchema['~standard'].validate({ name: 123 });
      expect(invalidResult.issues).toBeDefined();
      expect(invalidResult.issues!.length).toBeGreaterThan(0);
    });
  });
});
