import { Container, Module, type ModuleMetadata } from '@voxeljs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { Test, TestingModule, TestModuleBuilder } from './test-module.ts';

describe('Test', () => {
  describe('createModule', () => {
    it('should create a TestModuleBuilder', () => {
      const builder = Test.createModule();
      expect(builder).toBeInstanceOf(TestModuleBuilder);
    });

    it('should create a TestModuleBuilder with empty config', () => {
      const builder = Test.createModule({});
      expect(builder).toBeInstanceOf(TestModuleBuilder);
    });

    it('should create a TestModuleBuilder with providers', () => {
      class UserService {
        getUsers() {
          return ['user1'];
        }
      }

      const builder = Test.createModule({
        providers: [UserService],
      });

      expect(builder).toBeInstanceOf(TestModuleBuilder);
    });
  });
});

describe('TestModuleBuilder', () => {
  describe('compile', () => {
    it('should compile and return a TestingModule', async () => {
      const testingModule = await Test.createModule().compile();
      expect(testingModule).toBeInstanceOf(TestingModule);
    });

    it('should compile with providers', async () => {
      class UserService {
        static readonly inject = {} as const;
        constructor(_deps: typeof UserService.inject) {}
        getUsers() {
          return ['user1', 'user2'];
        }
      }

      const testingModule = await Test.createModule({
        providers: [UserService],
      }).compile();

      const service = testingModule.get(
        UserService as unknown as abstract new (...args: unknown[]) => UserService,
      ) as UserService;
      expect(service.getUsers()).toEqual(['user1', 'user2']);
    });

    it('should compile with providers with dependencies', async () => {
      class Logger {
        static readonly inject = {} as const;
        constructor(_deps: typeof Logger.inject) {}
        log(msg: string) {
          return `Logged: ${msg}`;
        }
      }

      class UserService {
        static readonly inject = { logger: Logger as unknown as abstract new (...args: unknown[]) => Logger } as const;
        constructor(private deps: typeof UserService.inject) {}
        getUsers() {
          (this.deps.logger as unknown as Logger).log('Getting users');
          return ['user1'];
        }
      }

      const testingModule = await Test.createModule({
        providers: [Logger, UserService],
      }).compile();

      const service = testingModule.get(
        UserService as unknown as abstract new (...args: unknown[]) => UserService,
      ) as UserService;
      expect(service.getUsers()).toEqual(['user1']);
    });
  });

  describe('overrideProvider', () => {
    it('should override a provider with mock implementation', async () => {
      class UserService {
        static readonly inject = {} as const;
        constructor(_deps: typeof UserService.inject) {}
        getUsers() {
          return ['real-user'];
        }
      }

      const mockUserService = {
        getUsers: () => ['mock-user'],
      };

      const testingModule = await Test.createModule({
        providers: [UserService],
      })
        .overrideProvider(UserService as unknown as abstract new (...args: unknown[]) => UserService, mockUserService)
        .compile();

      const service = testingModule.get(
        UserService as unknown as abstract new (...args: unknown[]) => UserService,
      ) as typeof mockUserService;
      expect(service.getUsers()).toEqual(['mock-user']);
    });

    it('should override a string token provider', async () => {
      const mockLogger = {
        log: (_msg: string) => {},
      };

      const testingModule = await Test.createModule().overrideProvider('Logger', mockLogger).compile();

      expect(testingModule.get('Logger')).toBe(mockLogger);
    });

    it('should override multiple providers', async () => {
      const mockLogger = {
        log: (_msg: string) => {},
      };
      const mockDb = {
        query: () => [],
      };

      const testingModule = await Test.createModule()
        .overrideProvider('Logger', mockLogger)
        .overrideProvider('Database', mockDb)
        .compile();

      expect(testingModule.get('Logger')).toBe(mockLogger);
      expect(testingModule.get('Database')).toBe(mockDb);
    });
  });

  describe('overrideProviderFactory', () => {
    it('should override with a factory function', async () => {
      const mockUserService = {
        getUsers: () => ['factory-user'],
      };

      const testingModule = await Test.createModule()
        .overrideProviderFactory('UserService', () => mockUserService)
        .compile();

      expect(testingModule.get('UserService')).toBe(mockUserService);
    });
  });

  describe('addProvider', () => {
    it('should add a provider to the test module', async () => {
      const mockService = {
        getValue: () => 42,
      };

      const testingModule = await Test.createModule().addProvider('MyService', mockService).compile();

      expect(testingModule.get('MyService')).toBe(mockService);
    });

    it('should add multiple providers', async () => {
      const service1 = { value: 1 };
      const service2 = { value: 2 };

      const testingModule = await Test.createModule()
        .addProvider('Service1', service1)
        .addProvider('Service2', service2)
        .compile();

      expect(testingModule.get('Service1')).toBe(service1);
      expect(testingModule.get('Service2')).toBe(service2);
    });
  });

  describe('with imports', () => {
    it('should import existing modules', async () => {
      class ConfigModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['Config'],
        };

        register(container: Container): void {
          container.register('Config', () => ({ port: 3000 }));
        }
      }

      const testingModule = await Test.createModule({
        imports: [ConfigModule],
      }).compile();

      const config = testingModule.get('Config') as { port: number };
      expect(config.port).toBe(3000);
    });
  });
});

describe('TestingModule', () => {
  let testingModule: TestingModule;

  beforeEach(async () => {
    testingModule = await Test.createModule()
      .addProvider('TestService', { getValue: () => 42 })
      .compile();
  });

  describe('get', () => {
    it('should resolve a provider by token', () => {
      const service = testingModule.get('TestService') as { getValue: () => number };
      expect(service.getValue()).toBe(42);
    });

    it('should throw for unregistered token', () => {
      expect(() => testingModule.get('Unknown')).toThrow(/Token 'Unknown' not found/);
    });
  });

  describe('has', () => {
    it('should return true for registered token', () => {
      expect(testingModule.has('TestService')).toBe(true);
    });

    it('should return false for unregistered token', () => {
      expect(testingModule.has('Unknown')).toBe(false);
    });
  });
});
