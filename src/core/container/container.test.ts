import { beforeEach, describe, expect, it } from 'vitest';
import { Scope } from './binding.ts';
import { Container } from './container.ts';
import type { DepsTokens } from '../types/deps.ts';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('register', () => {
    it('should register a provider with abstract class token', () => {
      abstract class ServiceBase {
        static readonly inject = [] as const satisfies DepsTokens<ServiceBase>;
      }
      class Service extends ServiceBase {
        getValue() {
          return 42;
        }
        static readonly inject = [] as const satisfies DepsTokens<Service>;
      }
      container.register(Service);
      expect(container.has(Service)).toBe(true);
    });

    it('should register a provider with concrete class token', () => {
      class Service {
        static readonly inject = [] as const satisfies DepsTokens<Service>;
        log() {
          return 'logged';
        }
      }
      container.register(Service);
      expect(container.has(Service)).toBe(true);
    });

    it('should default to SINGLETON scope', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<Logger>;
      }
      container.register(Logger);
      const binding = container.getBinding(Logger);
      expect(binding?.scope).toBe(Scope.SINGLETON);
    });

    it('should throw TokenCollisionError for duplicate token', () => {
      class Token {
        static readonly inject = [] as const satisfies DepsTokens<Token>;
      }
      container.register(Token);
      expect(() => container.register(Token)).toThrow(/is already registered/);
    });

    it('should throw error for class without static inject', () => {
      class NoInject {}
      expect(() => container.register(NoInject)).toThrow(/must have.*static inject/);
    });
  });

  describe('resolve', () => {
    it('should resolve registered provider', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<Logger>;
        log(_msg: string) {}
      }
      container.register(Logger);

      const result = container.resolve(Logger);
      expect(result).toBeInstanceOf(Logger);
    });

    it('should resolve with auto-injected dependencies', () => {
      class Config {
        static readonly inject = [] as const satisfies DepsTokens<Config>;
        port = 3000;
      }
      class Server {
        static readonly inject = [Config] as const satisfies DepsTokens<Server>;
        constructor(private config: Config) {}
        getPort() {
          return this.config.port;
        }
      }
      container.register(Config);
      container.register(Server);

      const server = container.resolve(Server);
      expect(server.getPort()).toBe(3000);
    });

    it('should throw for unregistered token', () => {
      class Unknown {
        static readonly inject = [] as const satisfies DepsTokens<Unknown>;
      }
      expect(() => container.resolve(Unknown)).toThrow(/Token 'Unknown' not found/);
    });

    it('should create new instance for transient scope', () => {
      class Counter {
        static readonly inject = [] as const satisfies DepsTokens<Counter>;
        count = 0;
      }
      container.register(Counter, { scope: Scope.TRANSIENT });

      const instance1 = container.resolve(Counter);
      const instance2 = container.resolve(Counter);

      expect(instance1).not.toBe(instance2);
    });

    it('should return same instance for singleton scope', () => {
      class Counter {
        static readonly inject = [] as const satisfies DepsTokens<Counter>;
        count = 0;
      }
      container.register(Counter);

      const instance1 = container.resolve(Counter);
      const instance2 = container.resolve(Counter);

      expect(instance1).toBe(instance2);
    });
  });

  describe('has', () => {
    it('should return true for registered token', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<Logger>;
      }
      container.register(Logger);
      expect(container.has(Logger)).toBe(true);
    });

    it('should return false for unregistered token', () => {
      class Unknown {
        static readonly inject = [] as const satisfies DepsTokens<Unknown>;
      }
      expect(container.has(Unknown)).toBe(false);
    });

    it('should return false after clear', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<Logger>;
      }
      container.register(Logger);
      container.clear();
      expect(container.has(Logger)).toBe(false);
    });
  });

  describe('getBinding', () => {
    it('should return binding for registered token', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<Logger>;
      }
      container.register(Logger);
      const binding = container.getBinding(Logger);

      expect(binding).toBeDefined();
      expect(binding?.token).toBe(Logger);
      expect(binding?.scope).toBe(Scope.SINGLETON);
    });

    it('should return undefined for unregistered token', () => {
      class Unknown {
        static readonly inject = [] as const satisfies DepsTokens<Unknown>;
      }
      const binding = container.getBinding(Unknown);
      expect(binding).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all bindings', () => {
      class A {
        static readonly inject = [] as const satisfies DepsTokens<A>;
      }
      class B {
        static readonly inject = [] as const satisfies DepsTokens<B>;
      }
      class C {
        static readonly inject = [] as const satisfies DepsTokens<C>;
      }
      container.register(A);
      container.register(B);
      container.register(C);

      container.clear();

      expect(container.has(A)).toBe(false);
      expect(container.has(B)).toBe(false);
      expect(container.has(C)).toBe(false);
    });

    it('should allow re-registration after clear', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<Logger>;
        version = 1;
      }
      container.register(Logger);
      container.clear();
      container.register(Logger);

      const result = container.resolve(Logger);
      expect(result.version).toBe(1);
    });
  });
});

describe('Scope', () => {
  it('should have SINGLETON value', () => {
    expect(Scope.SINGLETON).toBe('singleton');
  });

  it('should have TRANSIENT value', () => {
    expect(Scope.TRANSIENT).toBe('transient');
  });

  it('should have SCOPED value', () => {
    expect(Scope.SCOPED).toBe('scoped');
  });
});
