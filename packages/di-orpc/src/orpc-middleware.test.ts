import { describe, it, expect } from 'vite-plus/test';
import { Container, Module, Injectable, SCOPE } from '@ultranomic/di';
import { OrpcMiddleware } from './orpc-middleware.js';

class TestService extends Injectable({ scope: SCOPE.SINGLETON }) {
  getUser() {
    return { id: '1', name: 'Test' };
  }
}

describe('OrpcMiddleware', () => {
  it('adds _isOrpcMiddleware static marker', () => {
    class TestMiddleware extends OrpcMiddleware({}) {}
    expect(TestMiddleware._isOrpcMiddleware).toBe(true);
  });

  it('does NOT add _path or _orpcPath static', () => {
    class TestMiddleware extends OrpcMiddleware({}) {}
    expect('_path' in TestMiddleware).toBe(false);
    expect('_orpcPath' in TestMiddleware).toBe(false);
  });

  it('extends Injectable (has _scope and _inject)', () => {
    class TestMiddleware extends OrpcMiddleware({}) {}
    expect(TestMiddleware._scope).toBe('SINGLETON');
    expect(TestMiddleware._inject).toEqual([]);
  });

  it('passes inject config to Injectable', () => {
    class TestMiddleware extends OrpcMiddleware({ inject: [['service', TestService]] as const }) {}
    expect(TestMiddleware._inject).toEqual([TestService]);
  });

  it('this.orpc returns a builder from os.$context()', () => {
    class TestMiddleware extends OrpcMiddleware({}) {
      public getOrpc() {
        return this.orpc;
      }
    }
    const instance = new TestMiddleware();
    const builder = instance.getOrpc();
    expect(builder).toBeDefined();
    expect(typeof builder.input).toBe('function');
    expect(typeof builder.handler).toBe('function');
    expect(typeof builder.use).toBe('function');
    expect(typeof builder.middleware).toBe('function');
  });

  it('this.orpc.middleware() returns a valid middleware', () => {
    class TestMiddleware extends OrpcMiddleware({}) {
      public auth = this.orpc.middleware(async ({ next }) => next({ context: { user: 'test' } }));
    }
    const instance = new TestMiddleware();
    expect(instance.auth).toBeDefined();
    expect(typeof instance.auth.concat).toBe('function');
  });

  it('middleware .concat() chains two middlewares', () => {
    class TestMiddleware extends OrpcMiddleware({}) {
      public auth = this.orpc.middleware(async ({ next }) => next({ context: { user: 'test' } }));
      public log = this.orpc.middleware(async ({ next }) => next());
    }
    const instance = new TestMiddleware();
    const chained = instance.auth.concat(instance.log);
    expect(chained).toBeDefined();
    expect(typeof chained.concat).toBe('function');
  });

  it('Container can resolve middleware instances', async () => {
    class TestMiddleware extends OrpcMiddleware({ inject: [['service', TestService]] as const }) {
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
      providers: [TestService, TestMiddleware],
    }) {}

    const container = new Container(TestModule);
    await container.start();
    const middleware = container.resolve(TestMiddleware);
    expect(middleware).toBeInstanceOf(TestMiddleware);
    expect(middleware.getService()).toBe(container.resolve(TestService));
    await container.stop();
  });

  it('supports custom TContext type', () => {
    type MyContext = { userId: string };
    class TestMiddleware extends OrpcMiddleware<MyContext>({}) {
      public auth = this.orpc.middleware(async ({ next }) => next({ context: { userId: '1' } }));
    }
    const instance = new TestMiddleware();
    expect(instance.auth).toBeDefined();
  });
});
