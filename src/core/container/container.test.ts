import { beforeEach, describe, expect, it } from 'vitest';
import { BindingScope } from './binding.ts';
import { Container } from './container.ts';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('register', () => {
    it('should register a provider with abstract class token', () => {
      abstract class ServiceBase {}
      class Service extends ServiceBase {
        getValue() {
          return 42;
        }
      }
      container.register(ServiceBase, () => new Service());
      expect(container.has(ServiceBase)).toBe(true);
    });

    it('should register a provider with concrete class token', () => {
      class Service {
        log() {
          return 'logged';
        }
      }
      container.register(Service, () => new Service());
      expect(container.has(Service)).toBe(true);
    });

    it('should return BindingBuilder for fluent configuration', () => {
      class Logger {
        log() {}
      }
      const builder = container.register(Logger, () => new Logger());
      expect(builder).toBeDefined();
      expect(typeof builder.asSingleton).toBe('function');
      expect(typeof builder.asTransient).toBe('function');
      expect(typeof builder.asScoped).toBe('function');
    });

    it('should default to TRANSIENT scope', () => {
      class Logger {
        log() {}
      }
      container.register(Logger, () => new Logger());
      const binding = container.getBinding(Logger);
      expect(binding?.scope).toBe(BindingScope.TRANSIENT);
    });

    it('should throw TokenCollisionError for duplicate token', () => {
      class Token {
        value: number;
        constructor(v: number) {
          this.value = v;
        }
      }
      container.register(Token, () => new Token(1));
      expect(() => container.register(Token, () => new Token(2))).toThrow(/is already registered/);
    });
  });

  describe('resolve', () => {
    it('should resolve registered provider', () => {
      class Logger {
        log(_msg: string) {}
      }
      const logger = new Logger();
      container.register(Logger, () => logger);

      const result = container.resolve(Logger);
      expect(result).toBe(logger);
    });

    it('should resolve with factory receiving container', () => {
      class Config {
        port = 3000;
      }
      class Server {
        port: number;
        constructor(c: { resolve<T>(token: abstract new (...args: any[]) => T): T }) {
          this.port = c.resolve(Config).port;
        }
      }
      container.register(Config, () => new Config());
      container.register(Server, (c) => new Server(c));

      const server = container.resolve(Server);
      expect(server.port).toBe(3000);
    });

    it('should throw for unregistered token', () => {
      class Unknown {}
      expect(() => container.resolve(Unknown)).toThrow(/Token 'Unknown' not found/);
    });

    it('should create new instance for transient scope', () => {
      class Counter {
        count = 0;
      }
      container.register(Counter, () => new Counter());

      const instance1 = container.resolve(Counter);
      const instance2 = container.resolve(Counter);

      expect(instance1).not.toBe(instance2);
    });

    it('should return same instance for singleton scope', () => {
      class Counter {
        count = 0;
      }
      container.register(Counter, () => new Counter()).asSingleton();

      const instance1 = container.resolve(Counter);
      const instance2 = container.resolve(Counter);

      expect(instance1).toBe(instance2);
    });

    it('should cache singleton instance after first resolution', () => {
      let callCount = 0;
      class Expensive {
        data = 'expensive';
      }
      container
        .register(Expensive, () => {
          callCount++;
          return new Expensive();
        })
        .asSingleton();

      container.resolve(Expensive);
      container.resolve(Expensive);
      container.resolve(Expensive);

      expect(callCount).toBe(1);
    });
  });

  describe('has', () => {
    it('should return true for registered token', () => {
      class Logger {
        log() {}
      }
      container.register(Logger, () => new Logger());
      expect(container.has(Logger)).toBe(true);
    });

    it('should return false for unregistered token', () => {
      class Unknown {}
      expect(container.has(Unknown)).toBe(false);
    });

    it('should return false after clear', () => {
      class Logger {
        log() {}
      }
      container.register(Logger, () => new Logger());
      container.clear();
      expect(container.has(Logger)).toBe(false);
    });
  });

  describe('getBinding', () => {
    it('should return binding for registered token', () => {
      class Logger {
        log() {}
      }
      container.register(Logger, () => new Logger());
      const binding = container.getBinding(Logger);

      expect(binding).toBeDefined();
      expect(binding?.token).toBe(Logger);
      expect(binding?.scope).toBe(BindingScope.TRANSIENT);
    });

    it('should return undefined for unregistered token', () => {
      class Unknown {}
      const binding = container.getBinding(Unknown);
      expect(binding).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all bindings', () => {
      class A {
        a = 1;
      }
      class B {
        b = 2;
      }
      class C {
        c = 3;
      }
      container.register(A, () => new A());
      container.register(B, () => new B());
      container.register(C, () => new C());

      container.clear();

      expect(container.has(A)).toBe(false);
      expect(container.has(B)).toBe(false);
      expect(container.has(C)).toBe(false);
    });

    it('should allow re-registration after clear', () => {
      class Logger {
        version = 1;
      }
      container.register(Logger, () => new Logger());
      container.clear();
      container.register(Logger, () => new Logger());

      const result = container.resolve(Logger);
      expect(result.version).toBe(1);
    });
  });
});

describe('BindingBuilder', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('asSingleton', () => {
    it('should set scope to SINGLETON', () => {
      class Service {
        data = 'test';
      }
      container.register(Service, () => new Service()).asSingleton();
      const binding = container.getBinding(Service);

      expect(binding?.scope).toBe(BindingScope.SINGLETON);
    });
  });

  describe('asTransient', () => {
    it('should set scope to TRANSIENT', () => {
      class Service {
        data = 'test';
      }
      container.register(Service, () => new Service());
      const binding = container.getBinding(Service);
      expect(binding?.scope).toBe(BindingScope.TRANSIENT);
    });
  });

  describe('asScoped', () => {
    it('should set scope to SCOPED', () => {
      class Service {
        data = 'test';
      }
      container.register(Service, () => new Service()).asScoped();
      const binding = container.getBinding(Service);

      expect(binding?.scope).toBe(BindingScope.SCOPED);
    });
  });
});

describe('BindingScope', () => {
  it('should have SINGLETON value', () => {
    expect(BindingScope.SINGLETON).toBe('SINGLETON');
  });

  it('should have TRANSIENT value', () => {
    expect(BindingScope.TRANSIENT).toBe('TRANSIENT');
  });

  it('should have SCOPED value', () => {
    expect(BindingScope.SCOPED).toBe('SCOPED');
  });
});

describe('Token type inference', () => {
  it('should work with abstract class tokens', () => {
    abstract class LoggerBase {
      abstract log(msg: string): void;
    }
    class Logger implements LoggerBase {
      log(_msg: string) {}
    }
    const container = new Container();
    container.register(LoggerBase, () => new Logger());

    const logger = container.resolve(LoggerBase);
    expect(typeof logger.log).toBe('function');
  });

  it('should work with concrete class tokens', () => {
    class Database {
      connect() {
        return true;
      }
    }

    const container = new Container();
    container.register(Database, () => new Database());

    const db = container.resolve(Database);
    expect(db).toBeInstanceOf(Database);
    expect(db.connect()).toBe(true);
  });

  it('should work with multiple class tokens', () => {
    class Logger {
      log(_msg: string) {}
    }
    class Database {
      query(_sql: string) {
        return [];
      }
    }
    class Cache {
      get(_key: string) {
        return null;
      }
    }

    const container = new Container();
    container.register(Logger, () => new Logger());
    container.register(Database, () => new Database());
    container.register(Cache, () => new Cache());

    expect(container.has(Logger)).toBe(true);
    expect(container.has(Database)).toBe(true);
    expect(container.has(Cache)).toBe(true);

    const logger = container.resolve(Logger);
    const db = container.resolve(Database);
    const cache = container.resolve(Cache);

    expect(logger).toBeInstanceOf(Logger);
    expect(db).toBeInstanceOf(Database);
    expect(cache).toBeInstanceOf(Cache);
  });
});
