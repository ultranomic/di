import { beforeEach, describe, expect, it } from 'vitest';
import type { Token } from '../types/token.ts';
import { BindingScope } from './binding.ts';
import { Container } from './container.ts';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('register', () => {
    it('should register a provider with string token', () => {
      container.register('Logger', () => ({ log: () => {} }));
      expect(container.has('Logger')).toBe(true);
    });

    it('should register a provider with symbol token', () => {
      const token = Symbol('Database');
      container.register(token, () => ({ query: () => {} }));
      expect(container.has(token)).toBe(true);
    });

    it('should register a provider with class token', () => {
      abstract class ServiceBase {}
      class Service extends ServiceBase {
        getValue() {
          return 42;
        }
      }
      container.register(ServiceBase, () => new Service());
      expect(container.has(ServiceBase)).toBe(true);
    });

    it('should return BindingBuilder for fluent configuration', () => {
      const builder = container.register('Logger', () => ({ log: () => {} }));
      expect(builder).toBeDefined();
      expect(typeof builder.asSingleton).toBe('function');
      expect(typeof builder.asTransient).toBe('function');
      expect(typeof builder.asScoped).toBe('function');
    });

    it('should default to TRANSIENT scope', () => {
      container.register('Logger', () => ({ log: () => {} }));
      const binding = container.getBinding('Logger');
      expect(binding?.scope).toBe(BindingScope.TRANSIENT);
    });

    it('should throw TokenCollisionError for duplicate token', () => {
      container.register('Token', () => ({ value: 1 }));
      expect(() => container.register('Token', () => ({ value: 2 }))).toThrow(/is already registered/);
    });
  });

  describe('resolve', () => {
    it('should resolve registered provider', () => {
      const logger = { log: (_msg: string) => {} };
      container.register('Logger', () => logger);

      const result = container.resolve('Logger');
      expect(result).toBe(logger);
    });

    it('should resolve with factory receiving container', () => {
      container.register('Config', () => ({ port: 3000 }));
      container.register('Server', (c) => ({ port: c.resolve('Config').port }));

      const server = container.resolve('Server');
      expect(server.port).toBe(3000);
    });

    it('should throw for unregistered token', () => {
      expect(() => container.resolve('Unknown')).toThrow(/Token 'Unknown' not found/);
    });

    it('should throw for unregistered symbol token', () => {
      const token = Symbol('Unknown');
      expect(() => container.resolve(token)).toThrow(/Token '.*' not found/);
    });

    it('should create new instance for transient scope', () => {
      container.register('Counter', () => ({ count: 0 }));

      const instance1 = container.resolve('Counter');
      const instance2 = container.resolve('Counter');

      expect(instance1).not.toBe(instance2);
    });

    it('should return same instance for singleton scope', () => {
      container.register('Counter', () => ({ count: 0 })).asSingleton();

      const instance1 = container.resolve('Counter');
      const instance2 = container.resolve('Counter');

      expect(instance1).toBe(instance2);
    });

    it('should cache singleton instance after first resolution', () => {
      let callCount = 0;
      container
        .register('Expensive', () => {
          callCount++;
          return { data: 'expensive' };
        })
        .asSingleton();

      container.resolve('Expensive');
      container.resolve('Expensive');
      container.resolve('Expensive');

      expect(callCount).toBe(1);
    });
  });

  describe('has', () => {
    it('should return true for registered token', () => {
      container.register('Logger', () => ({}));
      expect(container.has('Logger')).toBe(true);
    });

    it('should return false for unregistered token', () => {
      expect(container.has('Unknown')).toBe(false);
    });

    it('should return false after clear', () => {
      container.register('Logger', () => ({}));
      container.clear();
      expect(container.has('Logger')).toBe(false);
    });
  });

  describe('getBinding', () => {
    it('should return binding for registered token', () => {
      container.register('Logger', () => ({}));
      const binding = container.getBinding('Logger');

      expect(binding).toBeDefined();
      expect(binding?.token).toBe('Logger');
      expect(binding?.scope).toBe(BindingScope.TRANSIENT);
    });

    it('should return undefined for unregistered token', () => {
      const binding = container.getBinding('Unknown');
      expect(binding).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all bindings', () => {
      container.register('A', () => ({}));
      container.register('B', () => ({}));
      container.register('C', () => ({}));

      container.clear();

      expect(container.has('A')).toBe(false);
      expect(container.has('B')).toBe(false);
      expect(container.has('C')).toBe(false);
    });

    it('should allow re-registration after clear', () => {
      container.register('Logger', () => ({ version: 1 }));
      container.clear();
      container.register('Logger', () => ({ version: 2 }));

      const result = container.resolve('Logger');
      expect(result).toEqual({ version: 2 });
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
      container.register('Service', () => ({})).asSingleton();
      const binding = container.getBinding('Service');

      expect(binding?.scope).toBe(BindingScope.SINGLETON);
    });
  });

  describe('asTransient', () => {
    it('should set scope to TRANSIENT', () => {
      container.register('Service', () => ({}));
      const binding = container.getBinding('Service');
      expect(binding?.scope).toBe(BindingScope.TRANSIENT);
    });
  });

  describe('asScoped', () => {
    it('should set scope to SCOPED', () => {
      container.register('Service', () => ({})).asScoped();
      const binding = container.getBinding('Service');

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
  it('should work with typed string tokens', () => {
    interface Logger {
      log(msg: string): void;
    }
    const container = new Container();
    container.register('Logger' as Token<Logger>, () => ({
      log: (_msg: string) => {},
    }));

    const logger = container.resolve('Logger' as Token<Logger>);
    expect(typeof logger.log).toBe('function');
  });

  it('should work with class tokens', () => {
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
});
