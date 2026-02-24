import { Container, Module, type ModuleMetadata } from '../core/index.js';
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
        private deps: typeof UserService.inject;
        constructor(deps: typeof UserService.inject) {
          this.deps = deps;
        }
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

  describe('providers with non-function values (line 115 else branch)', () => {
    it('should skip non-function providers in the providers array', async () => {
      // This tests the else branch at line 115 in test-module.ts
      // When a provider is not a function, it should be skipped
      const nonFunctionProvider = { value: 'not a function' };

      // Use type assertion to bypass TypeScript for this invalid input test
      const testingModule = await Test.createModule({
        providers: [nonFunctionProvider] as unknown as readonly (abstract new (...args: unknown[]) => unknown)[],
      }).compile();

      // The non-function provider should be silently skipped
      expect(testingModule).toBeInstanceOf(TestingModule);
    });

    it('should handle mixed function and non-function providers', async () => {
      class ValidService {
        getValue() {
          return 'valid';
        }
      }

      const testingModule = await Test.createModule({
        providers: [ValidService, { invalid: true }] as unknown as readonly (abstract new (...args: unknown[]) => unknown)[],
      }).compile();

      // ValidService should be registered, invalid one skipped
      const service = testingModule.get(ValidService) as ValidService;
      expect(service.getValue()).toBe('valid');
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

describe('TestModuleBuilder additional coverage', () => {
  describe('providers with array inject pattern (lines 131-132)', () => {
    it('should handle providers with array inject pattern', async () => {
      class Logger {
        log() {
          return 'logged';
        }
      }

      class UserService {
        static readonly inject = [Logger] as const;
        constructor(private logger: Logger) {}
        getUsers() {
          return [`user - ${this.logger.log()}`];
        }
      }

      const testingModule = await Test.createModule({
        providers: [Logger, UserService],
      }).compile();

      const service = testingModule.get(UserService) as UserService;
      expect(service.getUsers()).toEqual(['user - logged']);
    });

    it('should handle providers without inject property (line 148)', async () => {
      class SimpleService {
        getValue() {
          return 'simple';
        }
      }

      const testingModule = await Test.createModule({
        providers: [SimpleService],
      }).compile();

      const service = testingModule.get(SimpleService) as SimpleService;
      expect(service.getValue()).toBe('simple');
    });

    it('should handle mixed providers with and without inject', async () => {
      class Config {
        getValue() {
          return 42;
        }
      }

      class ServiceWithDeps {
        static readonly inject = [Config] as const;
        constructor(private config: Config) {}
        getValue() {
          return this.config.getValue() * 2;
        }
      }

      class SimpleService {
        getName() {
          return 'simple';
        }
      }

      const testingModule = await Test.createModule({
        providers: [Config, ServiceWithDeps, SimpleService],
      }).compile();

      const serviceWithDeps = testingModule.get(ServiceWithDeps) as ServiceWithDeps;
      expect(serviceWithDeps.getValue()).toBe(84);

      const simpleService = testingModule.get(SimpleService) as SimpleService;
      expect(simpleService.getName()).toBe('simple');
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
