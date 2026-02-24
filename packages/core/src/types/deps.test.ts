import { describe, expect, it } from 'vitest';
import type { InferInject, DepsTokens } from './deps.ts';
import type { TokenRegistry } from './token.ts';

describe('Deps types', () => {
  describe('InferInject', () => {
    it('should infer deps from string tokens with registry', () => {
      interface TestRegistry extends TokenRegistry {
        Logger: { log(msg: string): void };
        Database: { query(sql: string): Promise<unknown> };
      }

      const inject = ['Logger', 'Database'] as const;

      type TestDeps = InferInject<typeof inject, TestRegistry>;

      const deps: TestDeps = [{ log: (_msg: string) => undefined }, { query: async (_sql: string) => null }];

      expect(deps[0]).toBeDefined();
      expect(deps[1]).toBeDefined();
    });

    it('should return unknown for unregistered string tokens', () => {
      const inject = ['UnknownService'] as const;

      type TestDeps = InferInject<typeof inject>;
      const deps: TestDeps = [{ anything: 'goes' }];

      expect(deps[0]).toBeDefined();
    });

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

    it('should work with mixed token types', () => {
      class Config {
        get(key: string) {
          return key;
        }
      }

      interface TestRegistry extends TokenRegistry {
        Logger: { log(msg: string): void };
      }

      const inject = ['Logger', Config] as const;

      type MixedDeps = InferInject<typeof inject, TestRegistry>;

      const mockDeps: MixedDeps = [{ log: (_msg: string) => undefined }, new Config()];

      expect(mockDeps[0]).toBeDefined();
      expect(mockDeps[1]).toBeInstanceOf(Config);
    });

    it('should work with symbol tokens', () => {
      const DB_SYMBOL = Symbol('Database');

      interface TestRegistry extends TokenRegistry {
        [DB_SYMBOL]: { connect(): void };
      }

      const inject = [DB_SYMBOL] as const;

      type SymbolDeps = InferInject<typeof inject, TestRegistry>;

      const mockDeps: SymbolDeps = [{ connect: () => undefined }];

      expect(mockDeps[0]).toBeDefined();
    });

    it('should infer deps from class with static inject array', () => {
      class Logger {
        log(msg: string) {
          return msg;
        }
      }

      class MyService {
        static readonly inject = [Logger] as const;
        constructor(public logger: Logger) {}
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
        constructor(
          public logger: Logger,
          public db: Database,
        ) {}
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
  });
});
