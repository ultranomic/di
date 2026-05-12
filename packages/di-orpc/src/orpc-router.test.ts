import { describe, it, expect } from 'vite-plus/test';
import { Container, Module, Injectable, SCOPE } from '@ultranomic/di';
import { isProcedure } from '@orpc/server';
import { z } from 'zod';
import { OrpcRouter } from './orpc-router.js';

class TestService extends Injectable({ scope: SCOPE.SINGLETON }) {
  getData() {
    return ['item1', 'item2'];
  }
}

describe('OrpcRouter', () => {
  it('adds _isOrpcRouter static marker', () => {
    class TestRouter extends OrpcRouter({ path: 'test' }) {}
    expect(TestRouter._isOrpcRouter).toBe(true);
  });

  it('adds _orpcPath static matching config.path', () => {
    class TestRouter extends OrpcRouter({ path: 'users' }) {}
    expect(TestRouter._orpcPath).toBe('users');
  });

  it('does NOT add _path static (avoids HonoService collision)', () => {
    class TestRouter extends OrpcRouter({ path: 'test' }) {}
    expect('_path' in TestRouter).toBe(false);
  });

  it('extends Injectable (has _scope and _inject)', () => {
    class TestRouter extends OrpcRouter({ path: 'test' }) {}
    expect(TestRouter._scope).toBe('SINGLETON');
    expect(TestRouter._inject).toEqual([]);
  });

  it('passes inject config to Injectable', () => {
    class TestRouter extends OrpcRouter({
      path: 'test',
      inject: [['service', TestService]],
    }) {}
    expect(TestRouter._injectClasses).toEqual([TestService]);
  });

  it('this.orpc returns a builder from os.$context()', () => {
    class TestRouter extends OrpcRouter({ path: 'test' }) {
      public getOrpc() {
        return this.orpc;
      }
    }
    const instance = new TestRouter();
    const builder = instance.getOrpc();
    expect(builder).toBeDefined();
    expect(typeof builder.input).toBe('function');
    expect(typeof builder.handler).toBe('function');
    expect(typeof builder.use).toBe('function');
  });

  it('field initializer procedures are enumerable own properties', () => {
    class TestRouter extends OrpcRouter({ path: 'test' }) {
      public getItems = this.orpc.handler(async () => []);
    }
    const instance = new TestRouter();
    expect(Object.keys(instance)).toContain('getItems');
  });

  it('procedures built with this.orpc are valid ORPC procedures', () => {
    class TestRouter extends OrpcRouter({ path: 'test' }) {
      public getItems = this.orpc.input(z.object({})).handler(async ({ input }) => input);
    }
    const instance = new TestRouter();
    expect(isProcedure(instance.getItems)).toBe(true);
  });

  it('Container can resolve router instances', async () => {
    class TestRouter extends OrpcRouter({
      path: 'test',
      inject: [['service', TestService]],
    }) {
      readonly #service: TestService;
      constructor(service: TestService) {
        super(service);
        this.#service = service;
      }
      public getService() {
        return this.#service;
      }
    }

    class TestModule extends Module({
      providers: [TestService, TestRouter],
    }) {}

    const container = new Container(TestModule);
    await container.start();
    const router = container.resolve(TestRouter);
    expect(router).toBeInstanceOf(TestRouter);
    expect(router.getService()).toBe(container.resolve(TestService));
    await container.stop();
  });

  it('supports custom TContext type', () => {
    type MyContext = { userId: string };
    class TestRouter extends OrpcRouter<MyContext>({ path: 'test' }) {
      public getUser = this.orpc.handler(async () => ({ id: '1' }));
    }
    const instance = new TestRouter();
    expect(isProcedure(instance.getUser)).toBe(true);
  });
});
