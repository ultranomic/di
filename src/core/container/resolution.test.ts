import { beforeEach, describe, expect, it } from 'vitest';
import type { DependencyTokens } from '../types/dependencies.ts';
import { Container } from './container.ts';
import { Scope } from './binding.ts';

describe('Resolution with static inject', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('buildDependencies', () => {
    it('should build dependencies from empty inject array', () => {
      class Logger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        log(_msg: string) {}
      }
      container.register(Logger);

      const injectArray = [Logger] as const;
      const dependencies = container.buildDependencies(injectArray);

      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toBeInstanceOf(Logger);
    });

    it('should build dependencies from inject array with multiple dependencies', () => {
      class Logger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        log(_msg: string) {}
      }
      class Database {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        query(_sql: string) {}
      }
      container.register(Logger);
      container.register(Database);

      const injectArray = [Logger, Database] as const;

      const dependencies = container.buildDependencies(injectArray);

      expect(dependencies).toHaveLength(2);
    });

    it('should throw with resolution path when dependency not found', () => {
      class MissingService {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
      }
      const injectArray = [MissingService] as const;
      expect(() => container.buildDependencies(injectArray)).toThrow(/Token 'MissingService' not found/);
    });

    it('should work with abstract class tokens', () => {
      abstract class ServiceBase {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        abstract getValue(): number;
      }
      class Service extends ServiceBase {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        getValue() {
          return 42;
        }
      }
      container.register(Service);

      const injectArray = [Service] as const;
      const dependencies = container.buildDependencies(injectArray);

      expect(dependencies).toHaveLength(1);
      expect((dependencies[0] as Service).getValue()).toBe(42);
    });
  });

  describe('class with static inject', () => {
    it('should resolve class with no dependencies', () => {
      class NoDepsService {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        constructor() {}
        getValue() {
          return 42;
        }
      }

      container.register(NoDepsService);

      const service = container.resolve(NoDepsService);
      expect(service.getValue()).toBe(42);
    });

    it('should resolve class with single dependency', () => {
      class ConsoleLogger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        log(msg: string) {
          return msg;
        }
      }

      class UserService {
        static readonly inject = [ConsoleLogger] as const satisfies DependencyTokens<typeof this>;

        constructor(private logger: ConsoleLogger) {}

        getUser(id: string) {
          this.logger.log(`Getting user ${id}`);
          return { id };
        }
      }

      container.register(ConsoleLogger);
      container.register(UserService);

      const service = container.resolve(UserService);
      const user = service.getUser('123');
      expect(user.id).toBe('123');
    });

    it('should resolve class with multiple dependencies', () => {
      class ConsoleLogger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        log(_msg: string) {}
      }
      class PostgresDatabase {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        query(_sql: string) {
          return Promise.resolve({ id: '1', data: 'test' });
        }
      }
      class RedisCache {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        get(_key: string) {
          return null;
        }
      }

      class ComplexService {
        static readonly inject = [ConsoleLogger, PostgresDatabase, RedisCache] as const satisfies DependencyTokens<
          typeof this
        >;

        constructor(
          private logger: ConsoleLogger,
          private db: PostgresDatabase,
          private cache: RedisCache,
        ) {}

        async getData(id: string) {
          this.logger.log(`Fetching data for ${id}`);
          const cached = this.cache.get(id);
          if (cached) return cached;
          return this.db.query(`SELECT * FROM data WHERE id = ${id}`);
        }
      }

      container.register(ConsoleLogger);
      container.register(PostgresDatabase);
      container.register(RedisCache);
      container.register(ComplexService);

      const service = container.resolve(ComplexService);
      expect(service).toBeDefined();
    });

    it('should resolve nested dependencies', () => {
      // Level 1: Logger
      class Logger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        constructor() {}
        log(msg: string) {
          return msg;
        }
      }

      // Level 2: Database depends on Logger
      class Database {
        static readonly inject = [Logger] as const satisfies DependencyTokens<typeof this>;
        constructor(private logger: Logger) {}
        query(sql: string) {
          this.logger.log(`Query: ${sql}`);
          return { result: sql };
        }
      }

      // Level 3: UserService depends on Database
      class UserService {
        static readonly inject = [Database] as const satisfies DependencyTokens<typeof this>;
        constructor(private db: Database) {}
        getUser(id: string) {
          return this.db.query(`SELECT * FROM users WHERE id = ${id}`);
        }
      }

      container.register(Logger);
      container.register(Database);
      container.register(UserService);

      const service = container.resolve(UserService);
      const result = service.getUser('123');
      expect(result.result).toBe('SELECT * FROM users WHERE id = 123');
    });
  });

  describe('resolution context tracking', () => {
    it('should show available tokens in error message', () => {
      class Logger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        log() {}
      }
      class Database {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        query() {}
      }
      container.register(Logger);
      container.register(Database);

      class Unknown {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
      }
      expect(() => container.resolve(Unknown)).toThrow(/Available tokens:/);
    });

    it('should show token names in available tokens list', () => {
      class Logger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        log() {}
      }
      class Database {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        query() {}
      }
      container.register(Logger);
      container.register(Database);

      class Unknown {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
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
      class Level2Service {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
      }

      class Level1Service {
        static readonly inject = [Level2Service] as const satisfies DependencyTokens<typeof this>;
        constructor(_deps: Level2Service) {}
      }

      // Level2Service is NOT registered, causing failure
      container.register(Level1Service);

      expect(() => container.resolve(Level1Service)).toThrow(/Token 'Level2Service' not found/);
    });
  });

  describe('singleton scope with deps', () => {
    it('should reuse singleton dependencies', () => {
      let loggerInstantiationCount = 0;

      class Logger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        constructor() {
          loggerInstantiationCount++;
        }
        log(msg: string) {
          return msg;
        }
      }

      class ServiceA {
        static readonly inject = [Logger] as const satisfies DependencyTokens<typeof this>;
        constructor(_logger: Logger) {}
      }

      class ServiceB {
        static readonly inject = [Logger] as const satisfies DependencyTokens<typeof this>;
        constructor(_logger: Logger) {}
      }

      container.register(Logger);
      container.register(ServiceA);
      container.register(ServiceB);

      container.resolve(ServiceA);
      container.resolve(ServiceB);

      expect(loggerInstantiationCount).toBe(1);
    });

    it('should create new transient dependencies each time', () => {
      let loggerInstantiationCount = 0;

      class Logger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        constructor() {
          loggerInstantiationCount++;
        }
      }

      // Transient scope creates new instances each time it's resolved
      container.register(Logger, { scope: Scope.TRANSIENT });

      // Resolve the transient directly to verify new instances are created
      container.resolve(Logger);
      container.resolve(Logger);

      expect(loggerInstantiationCount).toBe(2);
    });
  });

  describe('resolution path in errors', () => {
    it('should include full resolution path when nested dependency not found', () => {
      class ServiceB {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
      }

      class ServiceA {
        static readonly inject = [ServiceB] as const satisfies DependencyTokens<typeof this>;
        constructor(_b: ServiceB) {}
      }

      // ServiceB is NOT registered
      container.register(ServiceA);

      try {
        container.resolve(ServiceA);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error;
        expect(err.message).toContain('ServiceA');
        expect(err.message).toContain('ServiceB');
        expect(err.message).toContain(' -> ');
      }
    });
  });
});
