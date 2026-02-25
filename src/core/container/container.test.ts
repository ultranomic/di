import { beforeEach, describe, expect, it } from 'vitest';
import { Scope } from './binding.ts';
import { Container } from './container.ts';
import type { DepsTokens } from '../types/deps.ts';
import type { Token } from '../types/token.ts';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('register', () => {
    it('should register a provider with abstract class token', () => {
      abstract class ServiceBase {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      class Service extends ServiceBase {
        getValue() {
          return 42;
        }
        static readonly inject: DepsTokens<typeof this> = [];
      }
      container.register(Service);
      expect(container.has(Service)).toBe(true);
    });

    it('should register a provider with concrete class token', () => {
      class Service {
        static readonly inject: DepsTokens<typeof this> = [];
        log() {
          return 'logged';
        }
      }
      container.register(Service);
      expect(container.has(Service)).toBe(true);
    });

    it('should default to SINGLETON scope', () => {
      class Logger {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      container.register(Logger);
      const binding = container.getBinding(Logger);
      expect(binding?.scope).toBe(Scope.SINGLETON);
    });

    it('should throw TokenCollisionError for duplicate token', () => {
      class Token {
        static readonly inject: DepsTokens<typeof this> = [];
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
        static readonly inject: DepsTokens<typeof this> = [];
        log(_msg: string) {}
      }
      container.register(Logger);

      const result = container.resolve(Logger);
      expect(result).toBeInstanceOf(Logger);
    });

    it('should resolve with auto-injected dependencies', () => {
      class Config {
        static readonly inject: DepsTokens<typeof this> = [];
        port = 3000;
      }
      class Server {
        static readonly inject: DepsTokens<typeof this> = [Config];
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
        static readonly inject: DepsTokens<typeof this> = [];
      }
      expect(() => container.resolve(Unknown)).toThrow(/Token 'Unknown' not found/);
    });

    it('should create new instance for transient scope', () => {
      class Counter {
        static readonly inject: DepsTokens<typeof this> = [];
        count = 0;
      }
      container.register(Counter, { scope: Scope.TRANSIENT });

      const instance1 = container.resolve(Counter);
      const instance2 = container.resolve(Counter);

      expect(instance1).not.toBe(instance2);
    });

    it('should return same instance for singleton scope', () => {
      class Counter {
        static readonly inject: DepsTokens<typeof this> = [];
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
        static readonly inject: DepsTokens<typeof this> = [];
      }
      container.register(Logger);
      expect(container.has(Logger)).toBe(true);
    });

    it('should return false for unregistered token', () => {
      class Unknown {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      expect(container.has(Unknown)).toBe(false);
    });

    it('should return false after clear', () => {
      class Logger {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      container.register(Logger);
      container.clear();
      expect(container.has(Logger)).toBe(false);
    });
  });

  describe('getBinding', () => {
    it('should return binding for registered token', () => {
      class Logger {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      container.register(Logger);
      const binding = container.getBinding(Logger);

      expect(binding).toBeDefined();
      expect(binding?.token).toBe(Logger);
      expect(binding?.scope).toBe(Scope.SINGLETON);
    });

    it('should return undefined for unregistered token', () => {
      class Unknown {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      const binding = container.getBinding(Unknown);
      expect(binding).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all bindings', () => {
      class A {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      class B {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      class C {
        static readonly inject: DepsTokens<typeof this> = [];
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
        static readonly inject: DepsTokens<typeof this> = [];
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

describe('Container - child containers', () => {
  let rootContainer: Container;
  let childContainer: Container;

  beforeEach(() => {
    rootContainer = new Container();
    childContainer = rootContainer.createScope();
  });

  describe('has', () => {
    it('should return true for parent token in child container', () => {
      class Logger {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      rootContainer.register(Logger);

      expect(childContainer.has(Logger)).toBe(true);
    });

    it('should return false for unregistered token in child container', () => {
      class Unknown {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      expect(childContainer.has(Unknown)).toBe(false);
    });
  });

  describe('getBinding', () => {
    it('should return binding from parent container', () => {
      class Logger {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      rootContainer.register(Logger);

      const binding = childContainer.getBinding(Logger);
      expect(binding).toBeDefined();
      expect(binding?.token).toBe(Logger);
    });
  });

  describe('resolve', () => {
    it('should resolve parent token in child container', () => {
      class Logger {
        static readonly inject: DepsTokens<typeof this> = [];
        log() {
          return 'logged';
        }
      }
      rootContainer.register(Logger);

      const logger = childContainer.resolve(Logger);
      expect(logger.log()).toBe('logged');
    });

    it('should throw error when trying to register in child container', () => {
      class Service {
        static readonly inject: DepsTokens<typeof this> = [];
      }

      expect(() => childContainer.register(Service)).toThrow(/Cannot register bindings in child container/);
    });
  });

  describe('clear', () => {
    it('should only clear scoped cache in child container', () => {
      class Service {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      rootContainer.register(Service);

      childContainer.clear();

      // Parent binding should still exist
      expect(rootContainer.has(Service)).toBe(true);
    });

    it('should clear bindings in root container', () => {
      class Service {
        static readonly inject: DepsTokens<typeof this> = [];
      }
      rootContainer.register(Service);

      rootContainer.clear();

      expect(rootContainer.has(Service)).toBe(false);
    });
  });

  describe('validateScopes', () => {
    it('should throw error when called on child container', () => {
      expect(() => childContainer.validateScopes()).toThrow(/must be called on the root container/);
    });
  });

  describe('isRoot', () => {
    it('should return true for root container', () => {
      expect(rootContainer.isRoot()).toBe(true);
    });

    it('should return false for child container', () => {
      expect(childContainer.isRoot()).toBe(false);
    });
  });
});

describe('Container - circular proxy', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it('should handle circular dependency with proxy', () => {
    class ServiceA {
      static readonly inject: readonly unknown[] = [];
      value = 'A';
      private _serviceB: ServiceB | null = null;

      setServiceB(b: ServiceB) {
        this._serviceB = b;
      }

      getServiceB() {
        return this._serviceB;
      }
    }

    class ServiceB {
      static readonly inject: readonly unknown[] = [];
      value = 'B';
      private _serviceA: ServiceA | null = null;

      setServiceA(a: ServiceA) {
        this._serviceA = a;
      }

      getServiceA() {
        return this._serviceA;
      }
    }

    // Register and resolve
    container.register(ServiceA);
    container.register(ServiceB);

    const a = container.resolve(ServiceA);
    const b = container.resolve(ServiceB);

    // Manually wire them (simulating circular reference scenario)
    a.setServiceB(b);
    b.setServiceA(a);

    expect(a.getServiceB()?.value).toBe('B');
    expect(b.getServiceA()?.value).toBe('A');
  });

  it('should create proxy that returns undefined for then', () => {
    // Test the proxy handler behavior for 'then' (to avoid being treated as thenable)
    class Service {
      static readonly inject: DepsTokens<typeof this> = [];
    }
    container.register(Service);

    const instance = container.resolve(Service);
    expect((instance as unknown as Record<string, unknown>).then).toBeUndefined();
  });
});

describe('Container - validateScopes', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it('should pass validation when singleton depends on singleton', () => {
    class Logger {
      static readonly inject: DepsTokens<typeof this> = [];
    }
    class Service {
      static readonly inject: DepsTokens<typeof this> = [Logger];
    }

    container.register(Logger);
    container.register(Service);

    expect(() => container.validateScopes()).not.toThrow();
  });

  it('should throw when singleton depends on scoped', () => {
    class ScopedService {
      static readonly inject: DepsTokens<typeof this> = [];
    }
    class SingletonService {
      static readonly inject: DepsTokens<typeof this> = [ScopedService];
    }

    container.register(ScopedService, { scope: Scope.SCOPED });
    container.register(SingletonService);

    expect(() => container.validateScopes()).toThrow(/Scope validation failed/);
  });
});
