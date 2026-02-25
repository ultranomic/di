import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from '../container/container.ts';
import type { ContainerInterface } from '../container/interfaces.ts';
import { Scope } from '../container/binding.ts';
import type { DepsTokens } from '../types/deps.ts';
import type { ModuleMetadata } from './module.ts';
import { Module } from './module.ts';
import { ModuleRegistry } from './registry.ts';

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;
  let container: Container;

  beforeEach(() => {
    registry = new ModuleRegistry();
    container = new Container();
  });

  describe('register', () => {
    it('should register a single module', async () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      registry.register(TestModule);
      await registry.loadModules(container);

      expect(registry.isLoaded(TestModule)).toBe(true);
    });

    it('should register multiple modules', async () => {
      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      registry.register(ModuleA);
      registry.register(ModuleB);
      await registry.loadModules(container);

      expect(registry.isLoaded(ModuleA)).toBe(true);
      expect(registry.isLoaded(ModuleB)).toBe(true);
    });

    it('should handle duplicate registration', async () => {
      let registerCount = 0;

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {
          registerCount++;
        }
      }

      registry.register(TestModule);
      registry.register(TestModule);
      await registry.loadModules(container);

      expect(registerCount).toBe(1);
    });
  });

  describe('loadModules', () => {
    it('should load modules and register providers with container', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Logger],
        };

        register(container: ContainerInterface): void {
          container.register(Logger);
        }
      }

      registry.register(TestModule);
      await registry.loadModules(container);

      expect(container.has(Logger)).toBe(true);
      const logger = container.resolve(Logger) as Logger;
      expect(logger.log()).toBe('logged');
    });

    it('should load multiple modules with different providers', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class Database {
        static readonly inject = [] as const;
        query() {
          return [];
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger],
        };

        register(container: ContainerInterface): void {
          container.register(Logger);
        }
      }

      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Database],
        };

        register(container: ContainerInterface): void {
          container.register(Database);
        }
      }

      registry.register(LoggerModule);
      registry.register(DatabaseModule);
      await registry.loadModules(container);

      expect(container.has(Logger)).toBe(true);
      expect(container.has(Database)).toBe(true);
    });
  });

  describe('import resolution', () => {
    it('should load imported modules before the module that imports them', async () => {
      const loadOrder: string[] = [];

      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {};

        register(_container: ContainerInterface): void {
          loadOrder.push('DatabaseModule');
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [DatabaseModule],
        };

        register(_container: ContainerInterface): void {
          loadOrder.push('UserModule');
        }
      }

      registry.register(UserModule);
      await registry.loadModules(container);

      expect(loadOrder).toEqual(['DatabaseModule', 'UserModule']);
    });

    it('should handle nested imports', async () => {
      const loadOrder: string[] = [];

      class ConfigModule extends Module {
        static readonly metadata: ModuleMetadata = {};

        register(_container: ContainerInterface): void {
          loadOrder.push('ConfigModule');
        }
      }

      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ConfigModule],
        };

        register(_container: ContainerInterface): void {
          loadOrder.push('DatabaseModule');
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [DatabaseModule],
        };

        register(_container: ContainerInterface): void {
          loadOrder.push('UserModule');
        }
      }

      registry.register(UserModule);
      await registry.loadModules(container);

      expect(loadOrder).toEqual(['ConfigModule', 'DatabaseModule', 'UserModule']);
    });

    it('should handle shared imports (diamond dependency)', async () => {
      const loadOrder: string[] = [];

      class SharedModule extends Module {
        static readonly metadata: ModuleMetadata = {};

        register(_container: ContainerInterface): void {
          loadOrder.push('SharedModule');
        }
      }

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SharedModule],
        };

        register(_container: ContainerInterface): void {
          loadOrder.push('ModuleA');
        }
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SharedModule],
        };

        register(_container: ContainerInterface): void {
          loadOrder.push('ModuleB');
        }
      }

      class AppModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA, ModuleB],
        };

        register(_container: ContainerInterface): void {
          loadOrder.push('AppModule');
        }
      }

      registry.register(AppModule);
      await registry.loadModules(container);

      expect(loadOrder).toEqual(['SharedModule', 'ModuleA', 'ModuleB', 'AppModule']);
    });

    it('should handle circular imports without infinite recursion', async () => {
      const loadOrder: string[] = [];

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {};

        register(_container: ContainerInterface): void {
          loadOrder.push('ModuleA');
        }
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA],
        };

        register(_container: ContainerInterface): void {
          loadOrder.push('ModuleB');
        }
      }

      (ModuleA as typeof Module & { metadata: ModuleMetadata }).metadata = {
        imports: [ModuleB],
      };
      registry.register(ModuleA);
      await registry.loadModules(container);
      expect(loadOrder.filter((m) => m === 'ModuleA')).toHaveLength(1);
      expect(loadOrder.filter((m) => m === 'ModuleB')).toHaveLength(1);
    });

    it('should make imported providers available to importing module', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger],
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
        }
      }

      class UserService {
        static readonly inject = [Logger] as const satisfies DepsTokens<typeof this>;

        private logger: Logger;
        constructor(logger: Logger) {
          this.logger = logger;
        }

        logSomething() {
          return this.logger.log();
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
          providers: [UserService],
        };

        register(container: ContainerInterface): void {
          container.register(UserService, { scope: Scope.SINGLETON });
        }
      }

      registry.register(UserModule);
      await registry.loadModules(container);

      const userService = container.resolve(UserService) as UserService;
      expect(userService.logSomething()).toBe('logged');
    });
  });

  describe('loadModule', () => {
    it('should load a single module directly', async () => {
      let wasRegistered = false;

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};

        register(_container: ContainerInterface): void {
          wasRegistered = true;
        }
      }

      await registry.loadModule(TestModule, container);

      expect(wasRegistered).toBe(true);
      expect(registry.isLoaded(TestModule)).toBe(true);
    });

    it('should not reload an already loaded module', async () => {
      let registerCount = 0;

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};

        register(_container: ContainerInterface): void {
          registerCount++;
        }
      }

      await registry.loadModule(TestModule, container);
      await registry.loadModule(TestModule, container);

      expect(registerCount).toBe(1);
    });
  });

  describe('isLoaded', () => {
    it('should return false for unloaded module', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      expect(registry.isLoaded(TestModule)).toBe(false);
    });

    it('should return true for loaded module', async () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      await registry.loadModule(TestModule, container);

      expect(registry.isLoaded(TestModule)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all registered and loaded modules', async () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      registry.register(TestModule);
      await registry.loadModules(container);

      expect(registry.isLoaded(TestModule)).toBe(true);

      await registry.clear();

      expect(registry.isLoaded(TestModule)).toBe(false);
    });
  });

  describe('lifecycle hooks', () => {
    describe('onModuleInit', () => {
      it('should call onModuleInit after module registration', async () => {
        const initSpy = vi.fn();

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: ContainerInterface): void {}
          override async onModuleInit(): Promise<void> {
            initSpy();
          }
        }

        registry.register(TestModule);
        await registry.loadModules(container);

        expect(initSpy).toHaveBeenCalledTimes(1);
      });

      it('should call onModuleInit on all modules in load order', async () => {
        const initOrder: string[] = [];

        class ModuleA extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: ContainerInterface): void {}
          override async onModuleInit(): Promise<void> {
            initOrder.push('ModuleA');
          }
        }

        class ModuleB extends Module {
          static readonly metadata: ModuleMetadata = {
            imports: [ModuleA],
          };
          register(_container: ContainerInterface): void {}
          override async onModuleInit(): Promise<void> {
            initOrder.push('ModuleB');
          }
        }

        registry.register(ModuleB);
        await registry.loadModules(container);

        expect(initOrder).toEqual(['ModuleA', 'ModuleB']);
      });

      it('should support synchronous onModuleInit', async () => {
        const initSpy = vi.fn();

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: ContainerInterface): void {}
          override onModuleInit(): void {
            initSpy();
          }
        }

        registry.register(TestModule);
        await registry.loadModules(container);

        expect(initSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('onModuleDestroy', () => {
      it('should call onModuleDestroy when destroyModules is called', async () => {
        const destroySpy = vi.fn();

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: ContainerInterface): void {}
          override async onModuleDestroy(): Promise<void> {
            destroySpy();
          }
        }

        registry.register(TestModule);
        await registry.loadModules(container);

        await registry.destroyModules();

        expect(destroySpy).toHaveBeenCalledTimes(1);
      });

      it('should call onModuleDestroy when clear is called', async () => {
        const destroySpy = vi.fn();

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: ContainerInterface): void {}
          override async onModuleDestroy(): Promise<void> {
            destroySpy();
          }
        }

        registry.register(TestModule);
        await registry.loadModules(container);

        await registry.clear();

        expect(destroySpy).toHaveBeenCalledTimes(1);
      });

      it('should destroy modules in reverse order of loading', async () => {
        const destroyOrder: string[] = [];

        class ModuleA extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: ContainerInterface): void {}
          override async onModuleDestroy(): Promise<void> {
            destroyOrder.push('ModuleA');
          }
        }

        class ModuleB extends Module {
          static readonly metadata: ModuleMetadata = {
            imports: [ModuleA],
          };
          register(_container: ContainerInterface): void {}
          override async onModuleDestroy(): Promise<void> {
            destroyOrder.push('ModuleB');
          }
        }

        registry.register(ModuleB);
        await registry.loadModules(container);
        await registry.destroyModules();

        // ModuleB should be destroyed first, then ModuleA
        expect(destroyOrder).toEqual(['ModuleB', 'ModuleA']);
      });

      it('should support synchronous onModuleDestroy', async () => {
        const destroySpy = vi.fn();

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: ContainerInterface): void {}
          override onModuleDestroy(): void {
            destroySpy();
          }
        }

        registry.register(TestModule);
        await registry.loadModules(container);

        await registry.destroyModules();

        expect(destroySpy).toHaveBeenCalledTimes(1);
      });

      it('should not call onModuleDestroy if module was not loaded', async () => {
        const destroySpy = vi.fn();

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: ContainerInterface): void {}
          override async onModuleDestroy(): Promise<void> {
            destroySpy();
          }
        }

        // Register but don't load
        registry.register(TestModule);

        await registry.destroyModules();

        expect(destroySpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Module Encapsulation', () => {
    it('should allow access to exported tokens', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class Database {
        static readonly inject = [] as const;
        query() {
          return 'results';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger],
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
        }
      }

      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Database],
          exports: [Database],
        };

        register(container: ContainerInterface): void {
          container.register(Database, { scope: Scope.SINGLETON });
        }
      }

      class AppService {
        static readonly inject = [Logger, Database] as const satisfies DepsTokens<typeof this>;

        private logger: Logger;
        private database: Database;
        constructor(logger: Logger, database: Database) {
          this.logger = logger;
          this.database = database;
        }

        getData() {
          return this.database.query();
        }
      }

      class AppModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [DatabaseModule, LoggerModule], // Import both to access both
          providers: [AppService],
        };

        register(container: ContainerInterface): void {
          container.register(AppService, { scope: Scope.SINGLETON });
        }
      }

      registry.register(AppModule);
      await registry.loadModules(container);

      const appService = container.resolve(AppService) as AppService;
      expect(appService.getData()).toBe('results');
    });

    it('should deny access to non-exported tokens', async () => {
      class InternalLogger {
        static readonly inject = [] as const;
        log() {
          return 'internal';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          // InternalLogger is NOT exported
        };

        register(container: ContainerInterface): void {
          container.register(InternalLogger, { scope: Scope.SINGLETON });
        }
      }

      class UserService {
        static readonly inject = [InternalLogger] as const satisfies DepsTokens<typeof this>;

        private logger: InternalLogger;
        constructor(logger: InternalLogger) {
          this.logger = logger;
        }

        log() {
          return this.logger.log();
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
          providers: [UserService],
        };

        register(container: ContainerInterface): void {
          container.register(UserService, { scope: Scope.SINGLETON });
        }
      }

      registry.register(UserModule);

      await expect(registry.loadModules(container)).rejects.toThrow('is not exported');
    });

    it('should include helpful error message for non-exported token', async () => {
      class InternalLogger {
        static readonly inject = [] as const;
        log() {
          return 'internal';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [] as (typeof InternalLogger)[], // Empty exports
        };

        register(container: ContainerInterface): void {
          container.register(InternalLogger, { scope: Scope.SINGLETON });
        }
      }

      class UserService {
        static readonly inject = [InternalLogger] as const satisfies DepsTokens<typeof this>;

        private logger: InternalLogger;
        constructor(logger: InternalLogger) {
          this.logger = logger;
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
          providers: [UserService],
        };

        register(container: ContainerInterface): void {
          container.register(UserService, { scope: Scope.SINGLETON });
        }
      }

      registry.register(UserModule);

      let error: Error | undefined;
      try {
        await registry.loadModules(container);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error?.message).toContain('InternalLogger');
      expect(error?.message).toContain('LoggerModule');
      expect(error?.message).toContain('export');
      expect(error?.name).toBe('NonExportedTokenError');
    });

    it('should allow module to access its own non-exported tokens', async () => {
      class InternalLogger {
        static readonly inject = [] as const;
        log() {
          return 'internal';
        }
      }

      class PublicService {
        static readonly inject = [InternalLogger] as const satisfies DepsTokens<typeof this>;

        private logger: InternalLogger;
        constructor(logger: InternalLogger) {
          this.logger = logger;
        }

        log() {
          return this.logger.log();
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [PublicService], // Only export PublicService
          providers: [InternalLogger, PublicService],
        };

        register(container: ContainerInterface): void {
          container.register(InternalLogger, { scope: Scope.SINGLETON });
          container.register(PublicService, { scope: Scope.SINGLETON });
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
        };

        register(_container: ContainerInterface): void {}
      }

      registry.register(UserModule);

      // Should not throw because InternalLogger is used within its own module
      await registry.loadModules(container);

      const publicService = container.resolve(PublicService) as PublicService;
      expect(publicService.log()).toBe('internal');
    });

    it('should deny access to tokens from unimported modules', async () => {
      class SecretService {
        static readonly inject = [] as const;
        secret() {
          return 'secret';
        }
      }

      class SecretModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [SecretService],
        };

        register(container: ContainerInterface): void {
          container.register(SecretService, { scope: Scope.SINGLETON });
        }
      }

      // A different module that imports SecretModule
      class AdminModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SecretModule],
        };

        register(_container: ContainerInterface): void {}
      }

      class UserService {
        static readonly inject = [SecretService] as const satisfies DepsTokens<typeof this>;

        private secret: SecretService;
        constructor(secret: SecretService) {
          this.secret = secret;
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [AdminModule], // Imports AdminModule, not SecretModule directly
          providers: [UserService],
        };

        register(container: ContainerInterface): void {
          container.register(UserService, { scope: Scope.SINGLETON });
        }
      }

      registry.register(UserModule);

      let error: Error | undefined;
      try {
        await registry.loadModules(container);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error?.message).toContain('SecretService');
      expect(error?.message).toContain('SecretModule');
    });

    it('should return false for has() on non-exported tokens from imported modules', async () => {
      class InternalLogger {
        static readonly inject = [] as const;
        log() {
          return 'internal';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          // InternalLogger is NOT exported
        };

        register(container: ContainerInterface): void {
          container.register(InternalLogger, { scope: Scope.SINGLETON });
        }
      }

      let hasCheckResult: boolean | undefined;
      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
        };

        register(container: ContainerInterface): void {
          // has() should return false for non-exported tokens
          hasCheckResult = container.has(InternalLogger);
        }
      }

      registry.register(UserModule);
      await registry.loadModules(container);

      expect(hasCheckResult).toBe(false);
    });

    it('should return true for has() on exported tokens from imported modules', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger],
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
        }
      }

      let hasCheckResult: boolean | undefined;
      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
        };

        register(container: ContainerInterface): void {
          // has() should return true for exported tokens
          hasCheckResult = container.has(Logger);
        }
      }

      registry.register(UserModule);
      await registry.loadModules(container);

      expect(hasCheckResult).toBe(true);
    });

    // oxlint-disable-next-line jest/expect-expect
    it('should support getBinding() for exported tokens', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger],
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
        };

        register(container: ContainerInterface): void {
          // getBinding() should work for exported tokens
          const binding = container.getBinding(Logger);
          expect(binding).toBeDefined();
        }
      }

      registry.register(UserModule);
      await registry.loadModules(container);
    });

    it('should show accessible tokens in error message when module not imported', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class Database {
        static readonly inject = [] as const;
        query() {
          return 'results';
        }
      }

      // A module with exported tokens
      class SharedModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger, Database],
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
          container.register(Database, { scope: Scope.SINGLETON });
        }
      }

      // Module that imports SharedModule
      class AdminModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SharedModule],
        };

        register(_container: ContainerInterface): void {}
      }

      // Another module with a different exported token
      class SecretService {
        static readonly inject = [] as const;
        secret() {
          return 'secret';
        }
      }

      // oxlint-disable-next-line eslint(no-unused-vars)
      class SecretModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [SecretService],
        };

        register(container: ContainerInterface): void {
          container.register(SecretService, { scope: Scope.SINGLETON });
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [AdminModule], // Only imports AdminModule, not SecretModule
        };

        register(container: ContainerInterface): void {
          // Try to access SecretService which is from an unimported module
          container.resolve(SecretService);
        }
      }

      registry.register(UserModule);

      let error: Error | undefined;
      try {
        await registry.loadModules(container);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      // Error message should show accessible tokens (Logger, Database from SharedModule)
      expect(error?.message).toContain('Logger');
      expect(error?.message).toContain('Database');
    });

    it('should return false for has() on tokens from unimported modules', async () => {
      class SecretService {
        static readonly inject = [] as const;
        secret() {
          return 'secret';
        }
      }

      // Module that will be loaded but not imported
      // oxlint-disable-next-line eslint(no-unused-vars)
      class SecretModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [SecretService],
        };

        register(container: ContainerInterface): void {
          container.register(SecretService, { scope: Scope.SINGLETON });
        }
      }

      // Intermediate module that imports SecretModule
      class ProxyModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SecretModule],
        };

        register(_container: ContainerInterface): void {}
      }

      let hasCheckResult: boolean | undefined;
      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ProxyModule],
        };

        register(container: ContainerInterface): void {
          // has() should return false for tokens from unimported modules
          // (SecretModule is imported by ProxyModule, but not by UserModule)
          hasCheckResult = container.has(SecretService);
        }
      }

      registry.register(UserModule);
      await registry.loadModules(container);

      expect(hasCheckResult).toBe(false);
    });

    // oxlint-disable-next-line jest/expect-expect
    it('should support clear() method', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger],
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
        };

        register(container: ContainerInterface): void {
          // clear() should delegate to base container
          expect(() => container.clear()).not.toThrow();
        }
      }

      registry.register(UserModule);
      await registry.loadModules(container);
    });

    // oxlint-disable-next-line jest/expect-expect
    it('should return true for has() on tokens from the same module', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          // Don't export Logger
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
          // has() should return true for our own tokens
          expect(container.has(Logger)).toBe(true);
        }
      }

      registry.register(LoggerModule);
      await registry.loadModules(container);
    });

    it('should list exported tokens in error for non-exported token access', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class Database {
        static readonly inject = [] as const;
        query() {
          return 'results';
        }
      }

      class InternalCache {
        static readonly inject = [] as const;
        get() {
          return 'cached';
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger, Database], // Export both
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
          container.register(Database, { scope: Scope.SINGLETON });
          container.register(InternalCache, { scope: Scope.SINGLETON }); // Not exported
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
        };

        register(container: ContainerInterface): void {
          // Try to access non-exported token
          container.resolve(InternalCache);
        }
      }

      registry.register(UserModule);

      let error: Error | undefined;
      try {
        await registry.loadModules(container);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      // Error should list exported tokens (Logger, Database)
      expect(error?.message).toContain('Logger');
      expect(error?.message).toContain('Database');
    });

    // oxlint-disable-next-line jest/expect-expect
    it('should delegate to base container for has() on untracked tokens', async () => {
      class NonExistentToken {}
      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {};

        register(container: ContainerInterface): void {
          // has() should delegate to base container for untracked tokens
          expect(container.has(NonExistentToken)).toBe(false);
        }
      }

      registry.register(UserModule);
      await registry.loadModules(container);
    });

    it('should include directly imported module exports in accessible tokens list', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      // Module with exported tokens
      class SharedModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger],
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
        }
      }

      // A service from SecretModule that IS exported
      class SecretService {
        static readonly inject = [] as const;
        secret() {
          return 'secret';
        }
      }

      // SecretModule exports SecretService
      class SecretModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [SecretService],
        };

        register(container: ContainerInterface): void {
          container.register(SecretService, { scope: Scope.SINGLETON });
        }
      }

      // UserModule imports SharedModule and SecretModule, has a service that depends on both
      class UserService {
        static readonly inject = [Logger, SecretService] as const satisfies DepsTokens<typeof this>;

        constructor(_logger: Logger, _secret: SecretService) {}
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SharedModule, SecretModule],
          providers: [UserService],
        };

        register(container: ContainerInterface): void {
          container.register(UserService, { scope: Scope.SINGLETON });
        }
      }

      // This should work because both Logger and SecretService are exported
      registry.register(UserModule);
      await registry.loadModules(container);

      const userService = container.resolve(UserService);
      expect(userService).toBeDefined();
    });

    it('should list accessible exported tokens when trying to access token from unimported module', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class Database {
        static readonly inject = [] as const;
        query() {
          return 'results';
        }
      }

      // Module with exported tokens
      class SharedModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger, Database],
        };

        register(container: ContainerInterface): void {
          container.register(Logger, { scope: Scope.SINGLETON });
          container.register(Database, { scope: Scope.SINGLETON });
        }
      }

      // A service from a different module
      class SecretService {
        static readonly inject = [] as const;
        secret() {
          return 'secret';
        }
      }

      // oxlint-disable-next-line eslint(no-unused-vars)
      class SecretModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [SecretService],
        };

        register(container: ContainerInterface): void {
          container.register(SecretService, { scope: Scope.SINGLETON });
        }
      }

      // Module that imports SharedModule (not SecretModule)
      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SharedModule],
        };

        register(container: ContainerInterface): void {
          // Try to access token from SecretModule which is NOT imported
          // This should error and list Logger from SharedModule as accessible
          container.resolve(SecretService);
        }
      }

      registry.register(UserModule);

      let error: Error | undefined;
      try {
        await registry.loadModules(container);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      // Error should list Logger (from SharedModule which is directly imported)
      expect(error?.message).toContain('Logger');
    });

    it('should call getAccessibleTokens when module is not imported', async () => {
      class Logger {
        static readonly inject = [] as const;
        log() {
          return 'logged';
        }
      }

      class Database {
        static readonly inject = [] as const;
        query() {
          return 'results';
        }
      }

      // Module with exported tokens that will be accessible
      class SharedModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [Logger, Database],
        };

        register(container: ContainerInterface): void {
          container.register(Logger);
          container.register(Database);
        }
      }

      // Another service from a module that won't be imported by UserModule
      class SecretService {
        static readonly inject = [] as const;
        secret() {
          return 'secret';
        }
      }

      class SecretModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [SecretService],
        };

        register(container: ContainerInterface): void {
          container.register(SecretService);
        }
      }

      // Module that imports SharedModule (not SecretModule)
      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SharedModule],
        };

        register(container: ContainerInterface): void {
          // Try to access token from SecretModule which is NOT imported
          // This should call getAccessibleTokens() which should return Logger and Database
          container.resolve(SecretService);
        }
      }

      // Register both modules - SecretModule will be loaded but not imported by UserModule
      registry.register(SecretModule);
      registry.register(UserModule);

      let error: Error | undefined;
      try {
        await registry.loadModules(container);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      // Error should list accessible tokens from SharedModule (Logger and Database)
      expect(error?.message).toContain('Logger');
      expect(error?.message).toContain('Database');
    });
  });

  describe('getModuleName branch coverage', () => {
    it('should handle module name when accessing module metadata', async () => {
      // The getModuleName function is private and called internally
      // We test it indirectly by ensuring modules with different names work
      class TestModule1 extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      // Create another module with a different name
      class TestModule2 extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      registry.register(TestModule1);
      registry.register(TestModule2);
      await registry.loadModules(container);

      // Both modules should be loaded and identifiable
      expect(registry.isLoaded(TestModule1)).toBe(true);
      expect(registry.isLoaded(TestModule2)).toBe(true);
    });

    it('should handle modules without onModuleDestroy', async () => {
      // This module doesn't have onModuleDestroy
      class NoDestroyModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      // This module has onModuleDestroy
      class WithDestroyModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
        override async onModuleDestroy(): Promise<void> {
          // Cleanup logic
        }
      }

      registry.register(NoDestroyModule);
      registry.register(WithDestroyModule);
      await registry.loadModules(container);

      // Should not throw when destroying modules (line 161 check: instance && instance.onModuleDestroy)
      await expect(registry.destroyModules()).resolves.toBeUndefined();
    });

    it('should handle undefined instances in loadedModuleInstances', async () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {}
      }

      registry.register(TestModule);
      await registry.loadModules(container);

      // Manually inject undefined into the array to simulate edge case
      (registry as unknown as { loadedModuleInstances: (ModuleInterface | undefined)[] }).loadedModuleInstances.push(
        undefined,
      );

      // Should not throw when encountering undefined (line 161 check: instance && instance.onModuleDestroy)
      await expect(registry.destroyModules()).resolves.toBeUndefined();
    });
  });
});
