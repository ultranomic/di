import { describe, expect, it } from 'vitest';
import type { DependencyTokens, InferInjectedInstanceTypes } from './dependencies.ts';

describe('Dependency types', () => {
  describe('InferInjectedInstanceTypes', () => {
    it('should infer type from class tokens', () => {
      class Logger {
        log(msg: string) {
          return msg;
        }
      }

      const inject = [Logger] as const;

      type TestDependencies = InferInjectedInstanceTypes<typeof inject>;
      const dependencies: TestDependencies = [new Logger()];

      expect(dependencies[0]).toBeInstanceOf(Logger);
    });

    it('should infer types from multiple class tokens', () => {
      class Logger {
        log(msg: string) {
          return msg;
        }
      }

      class Database {
        query(sql: string) {
          return sql;
        }
      }

      const inject = [Logger, Database] as const;

      type TestDependencies = InferInjectedInstanceTypes<typeof inject>;
      const dependencies: TestDependencies = [new Logger(), new Database()];

      expect(dependencies[0]).toBeInstanceOf(Logger);
      expect(dependencies[1]).toBeInstanceOf(Database);
    });

    it('should infer dependencies from class with static inject array', () => {
      class Logger {
        log(msg: string) {
          return msg;
        }
      }

      class MyService {
        static readonly inject = [Logger] as const;
        logger: Logger;
        constructor(logger: Logger) {
          this.logger = logger;
        }
      }

      type MyServiceDependencies = InferInjectedInstanceTypes<(typeof MyService)['inject']>;

      const mockDependencies: MyServiceDependencies = [new Logger()];

      expect(mockDependencies[0]).toBeInstanceOf(Logger);
    });
  });

  describe('DependencyTokens', () => {
    it('should validate inject array matches constructor params', () => {
      class Logger {}
      class Database {}

      class MyService {
        static readonly inject = [Logger, Database] as const satisfies DependencyTokens<typeof this>;
        logger: Logger;
        db: Database;
        constructor(logger: Logger, db: Database) {
          this.logger = logger;
          this.db = db;
        }
      }

      expect(MyService.inject).toHaveLength(2);
    });

    it('should work with empty constructor', () => {
      class NoDependenciesService {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        constructor() {}
      }

      expect(NoDependenciesService.inject).toHaveLength(0);
    });

    it('should work with single dependency', () => {
      class Logger {}

      class SingleDependencyService {
        static readonly inject = [Logger] as const satisfies DependencyTokens<typeof this>;
        logger: Logger;
        constructor(logger: Logger) {
          this.logger = logger;
        }
      }

      expect(SingleDependencyService.inject).toHaveLength(1);
    });
  });
});
