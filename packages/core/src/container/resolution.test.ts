import { beforeEach, describe, expect, it } from 'vitest';
import type { InferInject, InjectableClass, DepsTokens } from '../types/deps.ts';
import type { Token } from '../types/token.ts';
import { Container } from './container.ts';

describe('Resolution with static inject', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('buildDeps', () => {
    it('should build deps from empty inject array', () => {
      const injectArray = [] as const;
      const deps = container.buildDeps(injectArray);
      expect(deps).toEqual([]);
    });

    it('should build deps from inject array with single dependency', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} }));

      const injectArray = ['Logger'] as const;
      const deps = container.buildDeps(injectArray);

      expect(deps).toHaveLength(1);
      expect(typeof deps[0]).toBe('object');
    });

    it('should build deps from inject array with multiple dependencies', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} }));
      container.register('Database', () => ({ query: (_sql: string) => {} }));

      const injectArray = ['Logger', 'Database'] as const;

      const deps = container.buildDeps(injectArray);

      expect(deps).toHaveLength(2);
    });

    it('should throw with resolution path when dependency not found', () => {
      const injectArray = ['MissingService'] as const;
      expect(() => container.buildDeps(injectArray)).toThrow(/Token 'MissingService' not found/);
    });

    it('should work with symbol tokens', () => {
      const DB_TOKEN = Symbol('Database');
      container.register(DB_TOKEN, () => ({ connect: () => {} }));

      const injectArray = [DB_TOKEN] as const;
      const deps = container.buildDeps(injectArray);

      expect(deps).toHaveLength(1);
    });

    it('should work with class tokens', () => {
      abstract class ServiceBase {}
      class Service extends ServiceBase {
        getValue() {
          return 42;
        }
      }
      container.register(ServiceBase, () => new Service());

      const injectArray = [ServiceBase] as const;
      const deps = container.buildDeps(injectArray);

      expect(deps).toHaveLength(1);
      expect((deps[0] as Service).getValue()).toBe(42);
    });
  });

  describe('class with static inject', () => {
    it('should resolve class with no dependencies', () => {
      class NoDepsService {
        static readonly inject = [] as const;
        constructor() {}
        getValue() {
          return 42;
        }
      }

      container.register('NoDepsService', (c) => {
        return new NoDepsService(...c.buildDeps(NoDepsService.inject));
      });

      const service = container.resolve('NoDepsService') as NoDepsService;
      expect(service.getValue()).toBe(42);
    });

    it('should resolve class with single dependency', () => {
      interface Logger {
        log(msg: string): void;
      }

      class ConsoleLogger implements Logger {
        log(msg: string) {
          return msg;
        }
      }

      class UserService {
        static readonly inject = ['Logger'] as const;

        constructor(private logger: Logger) {}

        getUser(id: string) {
          this.logger.log(`Getting user ${id}`);
          return { id };
        }
      }

      container.register('Logger', () => new ConsoleLogger());
      container.register('UserService', (c) => {
        return new UserService(...(c.buildDeps(UserService.inject) as [Logger]));
      });

      const service = container.resolve('UserService') as UserService;
      const user = service.getUser('123');
      expect(user.id).toBe('123');
    });

    it('should resolve class with multiple dependencies', () => {
      interface Logger {
        log(msg: string): void;
      }
      interface Database {
        query(sql: string): Promise<unknown>;
      }
      interface Cache {
        get(key: string): unknown;
      }

      class ComplexService {
        static readonly inject = ['Logger', 'Database', 'Cache'] as const;

        constructor(
          private logger: Logger,
          private db: Database,
          private cache: Cache,
        ) {}

        async getData(id: string) {
          this.logger.log(`Fetching data for ${id}`);
          const cached = this.cache.get(id);
          if (cached) return cached;
          return this.db.query(`SELECT * FROM data WHERE id = ${id}`);
        }
      }

      container.register('Logger', () => ({
        log: (_msg: string) => {},
      }));
      container.register('Database', () => ({
        query: async (_sql: string) => ({ id: '1', data: 'test' }),
      }));
      container.register('Cache', () => ({
        get: (_key: string) => null,
      }));
      container.register('ComplexService', (c) => {
        return new ComplexService(...(c.buildDeps(ComplexService.inject) as [Logger, Database, Cache]));
      });

      const service = container.resolve('ComplexService') as ComplexService;
      expect(service).toBeDefined();
    });

    it('should resolve nested dependencies', () => {
      // Level 1: Logger
      class Logger {
        static readonly inject = [] as const;
        constructor() {}
        log(msg: string) {
          return msg;
        }
      }

      // Level 2: Database depends on Logger
      class Database {
        static readonly inject = [Logger] as const satisfies DepsTokens<typeof Database>;
        constructor(private logger: Logger) {}
        query(sql: string) {
          this.logger.log(`Query: ${sql}`);
          return { result: sql };
        }
      }

      // Level 3: UserService depends on Database
      class UserService {
        static readonly inject = [Database] as const satisfies DepsTokens<typeof UserService>;
        constructor(private db: Database) {}
        getUser(id: string) {
          return this.db.query(`SELECT * FROM users WHERE id = ${id}`);
        }
      }

      container.register(Logger, (c) => {
        return new Logger(...c.buildDeps(Logger.inject));
      });
      container.register(Database, (c) => {
        return new Database(...c.buildDeps(Database.inject));
      });
      container.register(UserService, (c) => {
        return new UserService(...c.buildDeps(UserService.inject));
      });

      const service = container.resolve(UserService) as UserService;
      const result = service.getUser('123');
      expect(result.result).toBe('SELECT * FROM users WHERE id = 123');
    });
  });

  describe('InjectableClass type', () => {
    it('should work with InjectableClass type for type-safe registration', () => {
      interface Logger {
        log(msg: string): void;
      }

      class MyService {
        static readonly inject = ['Logger'] as const;
        constructor(private logger: Logger) {}
        doSomething() {
          this.logger.log('Doing something');
        }
      }

      // Type check: MyService should work with the container
      const _ServiceClass = MyService;

      container.register('Logger', () => ({ log: (_msg: string) => {} }));
      container.register('MyService', (c) => {
        return new _ServiceClass(...(c.buildDeps(_ServiceClass.inject) as [Logger]));
      });

      const service = container.resolve('MyService') as MyService;
      expect(service).toBeInstanceOf(MyService);
    });
  });

  describe('resolution context tracking', () => {
    it('should show available tokens in error message', () => {
      container.register('Logger', () => ({}));
      container.register('Database', () => ({}));

      expect(() => container.resolve('Unknown')).toThrow(/Available tokens:/);
    });

    it('should show token names in available tokens list', () => {
      container.register('Logger', () => ({}));
      container.register('Database', () => ({}));

      try {
        container.resolve('Unknown');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Logger');
        expect((error as Error).message).toContain('Database');
      }
    });

    it('should track resolution path for nested resolution failures', () => {
      class Level1Service {
        static readonly inject = ['Level2Service'] as const;
        constructor(_deps: unknown) {}
      }

      // Level2Service is NOT registered, causing failure

      container.register('Level1Service', (c) => {
        return new Level1Service(...c.buildDeps(Level1Service.inject));
      });

      expect(() => container.resolve('Level1Service')).toThrow(/Token 'Level2Service' not found/);
    });
  });

  describe('singleton scope with deps', () => {
    it('should reuse singleton dependencies', () => {
      let loggerInstantiationCount = 0;

      class Logger {
        static readonly inject = [] as const;
        constructor() {
          loggerInstantiationCount++;
        }
        log(msg: string) {
          return msg;
        }
      }

      class ServiceA {
        static readonly inject = [Logger] as const satisfies DepsTokens<typeof ServiceA>;
        constructor(_logger: Logger) {}
      }

      class ServiceB {
        static readonly inject = [Logger] as const satisfies DepsTokens<typeof ServiceB>;
        constructor(_logger: Logger) {}
      }

      container
        .register(Logger, (c) => {
          return new Logger(...c.buildDeps(Logger.inject));
        })
        .asSingleton();

      container.register(ServiceA, (c) => {
        return new ServiceA(...c.buildDeps(ServiceA.inject));
      });

      container.register(ServiceB, (c) => {
        return new ServiceB(...c.buildDeps(ServiceB.inject));
      });

      container.resolve(ServiceA);
      container.resolve(ServiceB);

      expect(loggerInstantiationCount).toBe(1);
    });

    it('should create new transient dependencies each time', () => {
      let loggerInstantiationCount = 0;

      class Logger {
        static readonly inject = [] as const;
        constructor() {
          loggerInstantiationCount++;
        }
      }

      class ServiceA {
        static readonly inject = [Logger] as const satisfies DepsTokens<typeof ServiceA>;
        constructor(_logger: Logger) {}
      }

      // Default scope is TRANSIENT
      container.register(Logger, (c) => {
        return new Logger(...c.buildDeps(Logger.inject));
      });

      container.register(ServiceA, (c) => {
        return new ServiceA(...c.buildDeps(ServiceA.inject));
      });

      container.resolve(ServiceA);
      container.resolve(ServiceA);

      expect(loggerInstantiationCount).toBe(2);
    });
  });

  describe('mixed token types', () => {
    it('should work with string, symbol, and class tokens together', () => {
      abstract class ConfigBase {
        abstract get(key: string): string;
      }

      class Config extends ConfigBase {
        get(key: string) {
          return key;
        }
      }

      const CACHE_TOKEN = Symbol('Cache');

      class MixedService {
        static readonly inject = ['Logger', ConfigBase, CACHE_TOKEN] as const;

        constructor(_logger: unknown, _config: ConfigBase, _cache: unknown) {}
      }

      container.register('Logger', () => ({ log: (_msg: string) => {} }));
      container.register(ConfigBase, () => new Config());
      container.register(CACHE_TOKEN, () => ({ get: (_key: string) => null }));

      container.register('MixedService', (c) => {
        return new MixedService(...c.buildDeps(MixedService.inject));
      });

      const service = container.resolve('MixedService') as MixedService;
      expect(service).toBeInstanceOf(MixedService);
    });
  });

  describe('resolution path in errors', () => {
    it('should include full resolution path when nested dependency not found', () => {
      container.register('ServiceA', (c) => ({
        serviceB: c.resolve('ServiceB'),
      }));
      container.register('ServiceB', (c) => ({
        serviceC: c.resolve('MissingService'),
      }));

      try {
        container.resolve('ServiceA');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error;
        expect(err.message).toContain('ServiceA');
        expect(err.message).toContain('ServiceB');
        expect(err.message).toContain('MissingService');
        expect(err.message).toContain(' -> ');
      }
    });
  });

  describe('factory has access to resolver has method', () => {
    it('should allow factory to check if token exists using has', () => {
      let hasCalled = false;
      container.register('Logger', () => ({ log: (_msg: string) => {} }));
      container.register('Service', (c) => {
        hasCalled = c.has('Logger');
        return { hasLogger: c.has('Logger') };
      });

      const service = container.resolve<{ hasLogger: boolean }>('Service');

      expect(hasCalled).toBe(true);
      expect(service.hasLogger).toBe(true);
    });
  });
});
