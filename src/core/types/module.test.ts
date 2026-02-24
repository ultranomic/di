import { describe, expect, it } from 'vitest';
import type { ModuleClass, ModuleMetadata, OnModuleDestroy, OnModuleInit } from './module.ts';
import type { Token } from './token.ts';

describe('Module types', () => {
  describe('OnModuleInit', () => {
    it('should be implementable by classes', async () => {
      class TestService implements OnModuleInit {
        initialized = false;

        onModuleInit() {
          this.initialized = true;
        }
      }

      const service = new TestService();
      await service.onModuleInit();

      expect(service.initialized).toBe(true);
    });

    it('should support async initialization', async () => {
      class AsyncService implements OnModuleInit {
        connected = false;

        async onModuleInit() {
          await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
          this.connected = true;
        }
      }

      const service = new AsyncService();
      await service.onModuleInit();

      expect(service.connected).toBe(true);
    });
  });

  describe('OnModuleDestroy', () => {
    it('should be implementable by classes', async () => {
      class TestService implements OnModuleDestroy {
        destroyed = false;

        onModuleDestroy() {
          this.destroyed = true;
        }
      }

      const service = new TestService();
      await service.onModuleDestroy();

      expect(service.destroyed).toBe(true);
    });

    it('should support async destruction', async () => {
      class AsyncService implements OnModuleDestroy {
        disconnected = false;

        async onModuleDestroy() {
          await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
          this.disconnected = true;
        }
      }

      const service = new AsyncService();
      await service.onModuleDestroy();

      expect(service.disconnected).toBe(true);
    });

    it('should work with both lifecycle hooks', async () => {
      class DatabaseService implements OnModuleInit, OnModuleDestroy {
        connection: string | null = null;

        async onModuleInit() {
          this.connection = 'connected';
        }

        async onModuleDestroy() {
          this.connection = null;
        }
      }

      const service = new DatabaseService();
      await service.onModuleInit();
      expect(service.connection).toBe('connected');

      await service.onModuleDestroy();
      expect(service.connection).toBeNull();
    });
  });

  describe('ModuleMetadata', () => {
    it('should define valid module configuration', () => {
      class LoggerService {}

      const config: ModuleMetadata = {
        imports: [],
        providers: [LoggerService],
        controllers: [],
        exports: ['LoggerService'] as Token[],
      };

      expect(config.providers).toContain(LoggerService);
    });

    it('should allow empty module configuration', () => {
      const config: ModuleMetadata = {};

      expect(config.imports).toBeUndefined();
      expect(config.providers).toBeUndefined();
      expect(config.controllers).toBeUndefined();
      expect(config.exports).toBeUndefined();
    });

    it('should support string tokens in exports', () => {
      const config: ModuleMetadata = {
        exports: ['Logger', 'Database'] as Token[],
      };

      expect(config.exports).toContain('Logger');
      expect(config.exports).toContain('Database');
    });

    it('should support symbol tokens in exports', () => {
      const LOGGER = Symbol('Logger');
      const config: ModuleMetadata = {
        exports: [LOGGER] as Token[],
      };

      expect(config.exports).toContain(LOGGER);
    });
  });

  describe('ModuleClass', () => {
    it('should work with class modules', () => {
      class LoggerModule {
        static readonly imports = [];
        static readonly providers = [];
        static readonly controllers = [];
        static readonly exports = [];
      }

      const module: ModuleClass = LoggerModule;
      expect(module.imports).toEqual([]);
      expect(module.providers).toEqual([]);
    });

    it('should support full module definition', () => {
      class DatabaseModule {
        static readonly imports: unknown[] = [];
        static readonly providers: unknown[] = [];
        static readonly controllers: unknown[] = [];
        static readonly exports: Token[] = ['Database'];
      }

      class UserModule {
        static readonly imports = [DatabaseModule];
        static readonly providers: unknown[] = [];
        static readonly controllers: unknown[] = [];
        static readonly exports: Token[] = [];
      }

      const userModule: ModuleClass = UserModule;
      expect(userModule.imports).toContain(DatabaseModule);
    });
  });
});
