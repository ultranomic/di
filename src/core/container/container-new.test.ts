import { beforeEach, describe, expect, it } from 'vitest';
import { Scope } from './binding.ts';
import { Container } from './container.ts';
import type { DepsTokens } from '../types/deps.ts';

describe('Container (class-only registration)', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('register', () => {
    it('should register a class with static inject', () => {
      class Service {
        static readonly inject = [] as const satisfies DepsTokens<Service>;
      }
      container.register(Service);
      expect(container.has(Service)).toBe(true);
    });

    it('should default to singleton scope', () => {
      class Service {
        static readonly inject = [] as const satisfies DepsTokens<Service>;
      }
      container.register(Service);
      const binding = container.getBinding(Service);
      expect(binding?.scope).toBe(Scope.SINGLETON);
    });

    it('should allow explicit transient scope', () => {
      class Service {
        static readonly inject = [] as const satisfies DepsTokens<Service>;
      }
      container.register(Service, { scope: Scope.TRANSIENT });
      const binding = container.getBinding(Service);
      expect(binding?.scope).toBe(Scope.TRANSIENT);
    });

    it('should allow explicit scoped scope', () => {
      class Service {
        static readonly inject = [] as const satisfies DepsTokens<Service>;
      }
      container.register(Service, { scope: Scope.SCOPED });
      const binding = container.getBinding(Service);
      expect(binding?.scope).toBe(Scope.SCOPED);
    });

    it('should throw error for class without static inject', () => {
      class NoInject {}
      expect(() => container.register(NoInject)).toThrow(/must have.*static inject/);
    });

    it('should throw TokenCollisionError for duplicate token', () => {
      class Service {
        static readonly inject = [] as const satisfies DepsTokens<Service>;
      }
      container.register(Service);
      expect(() => container.register(Service)).toThrow(/is already registered/);
    });
  });

  describe('resolve', () => {
    it('should auto-instantiate class with no dependencies', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<Logger>;
        log() {
          return 'logged';
        }
      }
      container.register(Logger);

      const logger = container.resolve(Logger);
      expect(logger.log()).toBe('logged');
    });

    it('should auto-instantiate class with dependencies', () => {
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

    it('should return same instance for singleton', () => {
      class Counter {
        static readonly inject = [] as const satisfies DepsTokens<Counter>;
        count = 0;
      }
      container.register(Counter);

      const instance1 = container.resolve(Counter);
      const instance2 = container.resolve(Counter);
      expect(instance1).toBe(instance2);
    });

    it('should return new instance for transient', () => {
      class Counter {
        static readonly inject = [] as const satisfies DepsTokens<Counter>;
        count = 0;
      }
      container.register(Counter, { scope: Scope.TRANSIENT });

      const instance1 = container.resolve(Counter);
      const instance2 = container.resolve(Counter);
      expect(instance1).not.toBe(instance2);
    });
  });
});
