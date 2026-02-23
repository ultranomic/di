import { describe, expect, it } from 'vitest';
import type { Deps, InferDeps } from './deps.ts';
import type { Token, TokenRegistry } from './token.ts';

describe('Deps types', () => {
  describe('InferDeps', () => {
    it('should infer deps from string tokens with registry', () => {
      interface TestRegistry extends TokenRegistry {
        Logger: { log(msg: string): void };
        Database: { query(sql: string): Promise<unknown> };
      }

      const inject = {
        logger: 'Logger',
        db: 'Database',
      } as const satisfies Record<string, Token>;

      type TestDeps = InferDeps<typeof inject, TestRegistry>;

      const deps: TestDeps = {
        logger: { log: (_msg: string) => undefined },
        db: { query: async (_sql: string) => null },
      };

      expect(deps.logger).toBeDefined();
      expect(deps.db).toBeDefined();
    });

    it('should return unknown for unregistered string tokens', () => {
      const inject = {
        unknown: 'UnknownService',
      } as const satisfies Record<string, Token>;

      type TestDeps = InferDeps<typeof inject>;
      const deps: TestDeps = {
        unknown: { anything: 'goes' },
      };

      expect(deps.unknown).toBeDefined();
    });

    it('should infer type from class tokens', () => {
      class Logger {
        log(msg: string) {
          return msg;
        }
      }

      const inject = {
        logger: Logger,
      } as const satisfies Record<string, Token>;

      type TestDeps = InferDeps<typeof inject>;
      const deps: TestDeps = {
        logger: new Logger(),
      };

      expect(deps.logger).toBeInstanceOf(Logger);
    });
  });

  describe('Deps', () => {
    it('should infer deps from class with static inject', () => {
      interface TestRegistry extends TokenRegistry {
        Logger: { log(msg: string): void };
        Database: { query(sql: string): Promise<unknown> };
      }

      class MyService {
        static readonly inject = {
          logger: 'Logger',
          db: 'Database',
        } as const;

        constructor(private deps: InferDeps<typeof MyService.inject, TestRegistry>) {}
      }

      type MyServiceDeps = Deps<typeof MyService>;

      const mockDeps: MyServiceDeps = {
        logger: { log: (_msg: string) => undefined },
        db: { query: async (_sql: string) => null },
      };

      expect(mockDeps.logger).toBeDefined();
      expect(mockDeps.db).toBeDefined();
    });

    it('should work with mixed token types', () => {
      class Config {
        get(key: string) {
          return key;
        }
      }

      interface TestRegistry extends TokenRegistry {
        Logger: { log(msg: string): void };
      }

      class MixedService {
        static readonly inject = {
          logger: 'Logger',
          config: Config,
        } as const;

        constructor(private deps: InferDeps<typeof MixedService.inject, TestRegistry>) {}
      }

      type MixedDeps = Deps<typeof MixedService>;

      const mockDeps: MixedDeps = {
        logger: { log: (_msg: string) => undefined },
        config: new Config(),
      };

      expect(mockDeps.logger).toBeDefined();
      expect(mockDeps.config).toBeInstanceOf(Config);
    });

    it('should work with symbol tokens', () => {
      const DB_SYMBOL = Symbol('Database');

      interface TestRegistry extends TokenRegistry {
        [DB_SYMBOL]: { connect(): void };
      }

      class SymbolService {
        static readonly inject = {
          db: DB_SYMBOL,
        } as const;

        constructor(private deps: InferDeps<typeof SymbolService.inject, TestRegistry>) {}
      }

      type SymbolDeps = Deps<typeof SymbolService>;

      const mockDeps: SymbolDeps = {
        db: { connect: () => undefined },
      };

      expect(mockDeps.db).toBeDefined();
    });
  });
});
