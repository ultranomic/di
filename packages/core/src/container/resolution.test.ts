import { beforeEach, describe, expect, it } from 'vitest';
import type { InferDeps, InjectableClass } from '../types/deps.ts';
import { Container } from './container.ts';

describe('Resolution with static inject', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('buildDeps', () => {
    it('should build deps from empty inject map', () => {
      const injectMap = {};
      const deps = container.buildDeps(injectMap);
      expect(deps).toEqual({});
    });

    it('should build deps from inject map with single dependency', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} }));

      const injectMap = { logger: 'Logger' } as const;
      const deps = container.buildDeps(injectMap);

      expect(deps).toHaveProperty('logger');
      expect(typeof deps.logger).toBe('object');
    });

    it('should build deps from inject map with multiple dependencies', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} }));
      container.register('Database', () => ({ query: (_sql: string) => {} }));

      const injectMap = {
        logger: 'Logger',
        db: 'Database',
      } as const;

      const deps = container.buildDeps(injectMap);

      expect(deps).toHaveProperty('logger');
      expect(deps).toHaveProperty('db');
    });

    it('should throw with resolution path when dependency not found', () => {
      const injectMap = { missing: 'MissingService' } as const;
      expect(() => container.buildDeps(injectMap)).toThrow(/Token 'MissingService' not found/);
    });

    it('should work with symbol tokens', () => {
      const DB_TOKEN = Symbol('Database');
      container.register(DB_TOKEN, () => ({ connect: () => {} }));

      const injectMap = { db: DB_TOKEN } as const;
      const deps = container.buildDeps(injectMap);

      expect(deps).toHaveProperty('db');
    });

    it('should work with class tokens', () => {
      abstract class ServiceBase {}
      class Service extends ServiceBase {
        getValue() {
          return 42;
        }
      }
      container.register(ServiceBase, () => new Service());

      const injectMap = { service: ServiceBase } as const;
      const deps = container.buildDeps(injectMap);

      expect(deps).toHaveProperty('service');
      expect((deps.service as Service).getValue()).toBe(42);
    });
  });

  describe('class with static inject', () => {
    it('should resolve class with no dependencies', () => {
      class NoDepsService {
        static readonly inject = {} as const;
        constructor(_deps: InferDeps<typeof NoDepsService.inject>) {}
        getValue() {
          return 42;
        }
      }

      container.register('NoDepsService', (c) => {
        const deps = c.buildDeps(NoDepsService.inject);
        return new NoDepsService(deps as InferDeps<typeof NoDepsService.inject>);
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
        static readonly inject = { logger: 'Logger' } as const;

        constructor(private deps: InferDeps<typeof UserService.inject, { Logger: Logger }>) {}

        getUser(id: string) {
          this.deps.logger.log(`Getting user ${id}`);
          return { id };
        }
      }

      container.register('Logger', () => new ConsoleLogger());
      container.register('UserService', (c) => {
        const deps = c.buildDeps(UserService.inject) as InferDeps<typeof UserService.inject, { Logger: Logger }>;
        return new UserService(deps);
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
        static readonly inject = {
          logger: 'Logger',
          db: 'Database',
          cache: 'Cache',
        } as const;

        constructor(
          private deps: InferDeps<typeof ComplexService.inject, { Logger: Logger; Database: Database; Cache: Cache }>,
        ) {}

        async getData(id: string) {
          this.deps.logger.log(`Fetching data for ${id}`);
          const cached = this.deps.cache.get(id);
          if (cached) return cached;
          return this.deps.db.query(`SELECT * FROM data WHERE id = ${id}`);
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
        const deps = c.buildDeps(ComplexService.inject) as InferDeps<
          typeof ComplexService.inject,
          { Logger: Logger; Database: Database; Cache: Cache }
        >;
        return new ComplexService(deps);
      });

      const service = container.resolve('ComplexService') as ComplexService;
      expect(service).toBeDefined();
    });

    it('should resolve nested dependencies', () => {
      // Level 1: Logger
      class Logger {
        static readonly inject = {} as const;
        constructor(_deps: InferDeps<typeof Logger.inject>) {}
        log(msg: string) {
          return msg;
        }
      }

      // Level 2: Database depends on Logger
      class Database {
        static readonly inject = { logger: 'Logger' } as const;
        constructor(private deps: InferDeps<typeof Database.inject, { Logger: Logger }>) {}
        query(sql: string) {
          this.deps.logger.log(`Query: ${sql}`);
          return { result: sql };
        }
      }

      // Level 3: UserService depends on Database
      class UserService {
        static readonly inject = { db: 'Database' } as const;
        constructor(private deps: InferDeps<typeof UserService.inject, { Database: Database }>) {}
        getUser(id: string) {
          return this.deps.db.query(`SELECT * FROM users WHERE id = ${id}`);
        }
      }

      container.register('Logger', (c) => {
        const deps = c.buildDeps(Logger.inject);
        return new Logger(deps as InferDeps<typeof Logger.inject>);
      });
      container.register('Database', (c) => {
        const deps = c.buildDeps(Database.inject) as InferDeps<typeof Database.inject, { Logger: Logger }>;
        return new Database(deps);
      });
      container.register('UserService', (c) => {
        const deps = c.buildDeps(UserService.inject) as InferDeps<typeof UserService.inject, { Database: Database }>;
        return new UserService(deps);
      });

      const service = container.resolve('UserService') as UserService;
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
        static readonly inject = { logger: 'Logger' } as const;
        constructor(private deps: InferDeps<typeof MyService.inject, { Logger: Logger }>) {}
        doSomething() {
          this.deps.logger.log('Doing something');
        }
      }

      // Type check: MyService should be assignable to InjectableClass
      const _ServiceClass: InjectableClass<typeof MyService.inject, MyService> = MyService;

      container.register('Logger', () => ({ log: (_msg: string) => {} }));
      container.register('MyService', (c) => {
        const deps = c.buildDeps(_ServiceClass.inject) as InferDeps<typeof _ServiceClass.inject, { Logger: Logger }>;
        return new _ServiceClass(deps);
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
        static readonly inject = { level2: 'Level2Service' } as const;
        constructor(_deps: InferDeps<typeof Level1Service.inject>) {}
      }

      // Level2Service is NOT registered, causing failure

      container.register('Level1Service', (c) => {
        const deps = c.buildDeps(Level1Service.inject);
        return new Level1Service(deps as InferDeps<typeof Level1Service.inject>);
      });

      expect(() => container.resolve('Level1Service')).toThrow(/Token 'Level2Service' not found/);
    });
  });

  describe('singleton scope with deps', () => {
    it('should reuse singleton dependencies', () => {
      let loggerInstantiationCount = 0;

      class Logger {
        static readonly inject = {} as const;
        constructor(_deps: InferDeps<typeof Logger.inject>) {
          loggerInstantiationCount++;
        }
        log(msg: string) {
          return msg;
        }
      }

      class ServiceA {
        static readonly inject = { logger: 'Logger' } as const;
        constructor(private deps: InferDeps<typeof ServiceA.inject, { Logger: Logger }>) {}
      }

      class ServiceB {
        static readonly inject = { logger: 'Logger' } as const;
        constructor(private deps: InferDeps<typeof ServiceB.inject, { Logger: Logger }>) {}
      }

      container
        .register('Logger', (c) => {
          const deps = c.buildDeps(Logger.inject);
          return new Logger(deps as InferDeps<typeof Logger.inject>);
        })
        .asSingleton();

      container.register('ServiceA', (c) => {
        const deps = c.buildDeps(ServiceA.inject) as InferDeps<typeof ServiceA.inject, { Logger: Logger }>;
        return new ServiceA(deps);
      });

      container.register('ServiceB', (c) => {
        const deps = c.buildDeps(ServiceB.inject) as InferDeps<typeof ServiceB.inject, { Logger: Logger }>;
        return new ServiceB(deps);
      });

      container.resolve('ServiceA');
      container.resolve('ServiceB');

      expect(loggerInstantiationCount).toBe(1);
    });

    it('should create new transient dependencies each time', () => {
      let loggerInstantiationCount = 0;

      class Logger {
        static readonly inject = {} as const;
        constructor(_deps: InferDeps<typeof Logger.inject>) {
          loggerInstantiationCount++;
        }
      }

      class ServiceA {
        static readonly inject = { logger: 'Logger' } as const;
        constructor(_deps: InferDeps<typeof ServiceA.inject>) {}
      }

      // Default scope is TRANSIENT
      container.register('Logger', (c) => {
        const deps = c.buildDeps(Logger.inject);
        return new Logger(deps as InferDeps<typeof Logger.inject>);
      });

      container.register('ServiceA', (c) => {
        const deps = c.buildDeps(ServiceA.inject);
        return new ServiceA(deps as InferDeps<typeof ServiceA.inject>);
      });

      container.resolve('ServiceA');
      container.resolve('ServiceA');

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
        static readonly inject = {
          logger: 'Logger',
          config: ConfigBase,
          cache: CACHE_TOKEN,
        } as const;

        constructor(
          private deps: InferDeps<
            typeof MixedService.inject,
            {
              Logger: { log(msg: string): void };
              [ConfigBase]: Config;
              [typeof CACHE_TOKEN]: { get(key: string): unknown };
            }
          >,
        ) {}
      }

      container.register('Logger', () => ({ log: (_msg: string) => {} }));
      container.register(ConfigBase, () => new Config());
      container.register(CACHE_TOKEN, () => ({ get: (_key: string) => null }));

      container.register('MixedService', (c) => {
        const deps = c.buildDeps(MixedService.inject) as InferDeps<
          typeof MixedService.inject,
          {
            Logger: { log(msg: string): void };
            [ConfigBase]: Config;
            [typeof CACHE_TOKEN]: { get(key: string): unknown };
          }
        >;
        return new MixedService(deps);
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
