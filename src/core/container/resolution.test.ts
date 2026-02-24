import { beforeEach, describe, expect, it } from 'vitest';
import type { DepsTokens } from '../types/deps.ts';
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
      class Logger {
        log(_msg: string) {}
      }
      container.register(Logger, () => new Logger());

      const injectArray = [Logger] as const;
      const deps = container.buildDeps(injectArray);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toBeInstanceOf(Logger);
    });

    it('should build deps from inject array with multiple dependencies', () => {
      class Logger {
        log(_msg: string) {}
      }
      class Database {
        query(_sql: string) {}
      }
      container.register(Logger, () => new Logger());
      container.register(Database, () => new Database());

      const injectArray = [Logger, Database] as const;

      const deps = container.buildDeps(injectArray);

      expect(deps).toHaveLength(2);
    });

    it('should throw with resolution path when dependency not found', () => {
      class MissingService {}
      const injectArray = [MissingService] as const;
      expect(() => container.buildDeps(injectArray)).toThrow(/Token 'MissingService' not found/);
    });

    it('should work with abstract class tokens', () => {
      abstract class ServiceBase {
        abstract getValue(): number;
      }
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

      container.register(NoDepsService, (c) => {
        return new NoDepsService(...c.buildDeps(NoDepsService.inject));
      });

      const service = container.resolve(NoDepsService);
      expect(service.getValue()).toBe(42);
    });

    it('should resolve class with single dependency', () => {
      class ConsoleLogger {
        log(msg: string) {
          return msg;
        }
      }

      class UserService {
        static readonly inject = [ConsoleLogger] as const;

        private logger: ConsoleLogger;
        constructor(logger: ConsoleLogger) {
          this.logger = logger;
        }

        getUser(id: string) {
          this.logger.log(`Getting user ${id}`);
          return { id };
        }
      }

      container.register(ConsoleLogger, () => new ConsoleLogger());
      container.register(UserService, (c) => {
        return new UserService(...(c.buildDeps(UserService.inject) as [ConsoleLogger]));
      });

      const service = container.resolve(UserService);
      const user = service.getUser('123');
      expect(user.id).toBe('123');
    });

    it('should resolve class with multiple dependencies', () => {
      class ConsoleLogger {
        log(_msg: string) {}
      }
      class PostgresDatabase {
        query(_sql: string) {
          return Promise.resolve({ id: '1', data: 'test' });
        }
      }
      class RedisCache {
        get(_key: string) {
          return null;
        }
      }

      class ComplexService {
        static readonly inject = [ConsoleLogger, PostgresDatabase, RedisCache] as const;

        private logger: ConsoleLogger;
        private db: PostgresDatabase;
        private cache: RedisCache;
        constructor(logger: ConsoleLogger, db: PostgresDatabase, cache: RedisCache) {
          this.logger = logger;
          this.db = db;
          this.cache = cache;
        }

        async getData(id: string) {
          this.logger.log(`Fetching data for ${id}`);
          const cached = this.cache.get(id);
          if (cached) return cached;
          return this.db.query(`SELECT * FROM data WHERE id = ${id}`);
        }
      }

      container.register(ConsoleLogger, () => new ConsoleLogger());
      container.register(PostgresDatabase, () => new PostgresDatabase());
      container.register(RedisCache, () => new RedisCache());
      container.register(ComplexService, (c) => {
        return new ComplexService(...(c.buildDeps(ComplexService.inject) as [ConsoleLogger, PostgresDatabase, RedisCache]));
      });

      const service = container.resolve(ComplexService);
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
        private logger: Logger;
        constructor(logger: Logger) {
          this.logger = logger;
        }
        query(sql: string) {
          this.logger.log(`Query: ${sql}`);
          return { result: sql };
        }
      }

      // Level 3: UserService depends on Database
      class UserService {
        static readonly inject = [Database] as const satisfies DepsTokens<typeof UserService>;
        private db: Database;
        constructor(db: Database) {
          this.db = db;
        }
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

      const service = container.resolve(UserService);
      const result = service.getUser('123');
      expect(result.result).toBe('SELECT * FROM users WHERE id = 123');
    });
  });

  describe('InjectableClass type', () => {
    it('should work with InjectableClass type for type-safe registration', () => {
      class ConsoleLogger {
        log(_msg: string) {}
      }

      class MyService {
        static readonly inject = [ConsoleLogger] as const;
        private logger: ConsoleLogger;
        constructor(logger: ConsoleLogger) {
          this.logger = logger;
        }
        doSomething() {
          this.logger.log('Doing something');
        }
      }

      // Type check: MyService should work with the container
      const _ServiceClass = MyService;

      container.register(ConsoleLogger, () => new ConsoleLogger());
      container.register(MyService, (c) => {
        return new _ServiceClass(...(c.buildDeps(_ServiceClass.inject) as [ConsoleLogger]));
      });

      const service = container.resolve(MyService);
      expect(service).toBeInstanceOf(MyService);
    });
  });

  describe('resolution context tracking', () => {
    it('should show available tokens in error message', () => {
      class Logger {
        log() {}
      }
      class Database {
        query() {}
      }
      container.register(Logger, () => new Logger());
      container.register(Database, () => new Database());

      class Unknown {}
      expect(() => container.resolve(Unknown)).toThrow(/Available tokens:/);
    });

    it('should show token names in available tokens list', () => {
      class Logger {
        log() {}
      }
      class Database {
        query() {}
      }
      container.register(Logger, () => new Logger());
      container.register(Database, () => new Database());

      class Unknown {
        constructor() {
          throw new Error('Should not be called');
        }
      }
      try {
        container.resolve(Unknown);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Logger');
        expect((error as Error).message).toContain('Database');
      }
    });

    it('should track resolution path for nested resolution failures', () => {
      // Define Level2Service first to avoid temporal dead zone
      class Level2Service {
        constructor() {
          throw new Error('Level2Service not registered');
        }
      }

      class Level1Service {
        static readonly inject = [Level2Service] as const;
        constructor(_deps: unknown) {}
      }

      // Level2Service is NOT registered, causing failure

      container.register(Level1Service, (c) => {
        return new Level1Service(...c.buildDeps(Level1Service.inject));
      });

      expect(() => container.resolve(Level1Service)).toThrow(/Token 'Level2Service' not found/);
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

  describe('resolution path in errors', () => {
    it('should include full resolution path when nested dependency not found', () => {
      class ServiceA {
        constructor(_c: { resolve<T>(token: abstract new (...args: any[]) => T): T }) {
          // Access ServiceB through the container
        }
        serviceB() {
          return this;
        }
      }
      class ServiceB {
        constructor(_c: { resolve<T>(token: abstract new (...args: any[]) => T): T }) {}
        serviceC() {
          return this;
        }
      }
      class MissingService {}

      container.register(ServiceA, (c) => ({
        serviceB: c.resolve(ServiceB),
      }));
      container.register(ServiceB, (c) => ({
        serviceC: c.resolve(MissingService),
      }));

      try {
        container.resolve(ServiceA);
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
      class Logger {
        log() {}
      }
      class Service {
        hasLogger: boolean;
        constructor(c: { resolve<T>(token: abstract new (...args: any[]) => T): T; has: (token: abstract new (...args: any[]) => unknown) => boolean }) {
          hasCalled = c.has(Logger);
          this.hasLogger = c.has(Logger);
        }
      }
      container.register(Logger, () => new Logger());
      container.register(Service, (c) => new Service(c));

      const service = container.resolve(Service);

      expect(hasCalled).toBe(true);
      expect(service.hasLogger).toBe(true);
    });
  });
});
