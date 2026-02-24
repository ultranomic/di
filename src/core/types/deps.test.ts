import { describe, expect, it } from 'vitest';
import type { DepsTokens, InferInject } from './deps.ts';

describe('Deps types', () => {
  describe('InferInject', () => {
    it('should infer type from class tokens', () => {
      class Logger {
        log(msg: string) {
          return msg;
        }
      }

      const inject = [Logger] as const;

      type TestDeps = InferInject<typeof inject>;
      const deps: TestDeps = [new Logger()];

      expect(deps[0]).toBeInstanceOf(Logger);
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

      type TestDeps = InferInject<typeof inject>;
      const deps: TestDeps = [new Logger(), new Database()];

      expect(deps[0]).toBeInstanceOf(Logger);
      expect(deps[1]).toBeInstanceOf(Database);
    });

    it('should infer deps from class with static inject array', () => {
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

      type MyServiceDeps = InferInject<(typeof MyService)['inject']>;

      const mockDeps: MyServiceDeps = [new Logger()];

      expect(mockDeps[0]).toBeInstanceOf(Logger);
    });
  });

  describe('DepsTokens', () => {
    it('should validate inject array matches constructor params', () => {
      class Logger {}
      class Database {}

      class MyService {
        static readonly inject = [Logger, Database] as const satisfies DepsTokens<typeof MyService>;
        logger: Logger;
        db: Database;
        constructor(
          logger: Logger,
          db: Database,
        ) {
          this.logger = logger;
          this.db = db;
        }
      }

      expect(MyService.inject).toHaveLength(2);
    });

    it('should work with empty constructor', () => {
      class NoDepsService {
        static readonly inject = [] as const satisfies DepsTokens<typeof NoDepsService>;
        constructor() {}
      }

      expect(NoDepsService.inject).toHaveLength(0);
    });

    it('should work with single dependency', () => {
      class Logger {}

      class SingleDepService {
        static readonly inject = [Logger] as const satisfies DepsTokens<typeof SingleDepService>;
        logger: Logger;
        constructor(logger: Logger) {
          this.logger = logger;
        }
      }

      expect(SingleDepService.inject).toHaveLength(1);
    });
  });
});
