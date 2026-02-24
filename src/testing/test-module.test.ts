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
        static readonly inject = [] as const;
        constructor() {}
        getUsers() {
          return ['user1', 'user2'];
        }
      }

      const testingModule = await Test.createModule({
        providers: [UserService],
      }).compile();

      const service = testingModule.get(UserService);
      expect(service.getUsers()).toEqual(['user1', 'user2']);
    });

    it('should compile with providers with dependencies', async () => {
      class Logger {
        static readonly inject = [] as const;
        constructor() {}
        log(msg: string) {
          return `Logged: ${msg}`;
        }
      }

      class UserService {
        static readonly inject = [Logger] as const;
        constructor(private logger: Logger) {}
        getUsers() {
          this.logger.log('Getting users');
          return ['user1'];
        }
      }

      const testingModule = await Test.createModule({
        providers: [Logger, UserService],
      }).compile();

      const service = testingModule.get(UserService);
      expect(service.getUsers()).toEqual(['user1']);
    });
  });

  describe('overrideProvider', () => {
    it('should override a provider with mock implementation', async () => {
      class UserService {
        static readonly inject = [] as const;
        constructor() {}
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
        .overrideProvider(UserService, mockUserService)
        .compile();

      const service = testingModule.get(UserService) as typeof mockUserService;
      expect(service.getUsers()).toEqual(['mock-user']);
    });
  });

  describe('overrideProviderFactory', () => {
    it('should override with a factory function', async () => {
      class UserService {
        static readonly inject = [] as const;
        constructor() {}
        getUsers() {
          return ['real'];
        }
      }

      const mockUserService = {
        getUsers: () => ['factory-user'],
      };

      const testingModule = await Test.createModule({
        providers: [UserService],
      })
        .overrideProviderFactory(UserService, () => mockUserService)
        .compile();

      expect(testingModule.get(UserService)).toBe(mockUserService);
    });
  });

  describe('addProvider', () => {
    it('should add a provider to the test module', async () => {
      class TestService {
        getValue() {
          return 42;
        }
      }

      const testingModule = await Test.createModule().addProvider(TestService, new TestService()).compile();

      expect(testingModule.get(TestService).getValue()).toBe(42);
    });

    it('should add multiple providers', async () => {
      class Service1 {
        value = 1;
      }
      class Service2 {
        value = 2;
      }

      const testingModule = await Test.createModule()
        .addProvider(Service1, new Service1())
        .addProvider(Service2, new Service2())
        .compile();

      expect(testingModule.get(Service1).value).toBe(1);
      expect(testingModule.get(Service2).value).toBe(2);
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
        providers: [ValidService, { invalid: true }] as unknown as readonly (abstract new (
          ...args: unknown[]
        ) => unknown)[],
      }).compile();

      // ValidService should be registered, invalid one skipped
      const service = testingModule.get(ValidService);
      expect(service.getValue()).toBe('valid');
    });
  });

  describe('with imports', () => {
    it('should import existing modules', async () => {
      class ConfigService {
        port = 3000;
      }

      class ConfigModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [ConfigService],
        };

        register(container: Container): void {
          container.register(ConfigService, () => new ConfigService());
        }
      }

      const testingModule = await Test.createModule({
        imports: [ConfigModule],
      }).compile();

      const config = testingModule.get(ConfigService);
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

      const service = testingModule.get(UserService);
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

      const service = testingModule.get(SimpleService);
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

      const serviceWithDeps = testingModule.get(ServiceWithDeps);
      expect(serviceWithDeps.getValue()).toBe(84);

      const simpleService = testingModule.get(SimpleService);
      expect(simpleService.getName()).toBe('simple');
    });
  });
});

describe('TestingModule', () => {
  let testingModule: TestingModule;

  // Define the class at module level so it can be used in both setup and tests
  class TestService {
    getValue = () => 42;
  }

  beforeEach(async () => {
    testingModule = await Test.createModule().addProvider(TestService, new TestService()).compile();
  });

  describe('get', () => {
    it('should resolve a provider by token', () => {
      const service = testingModule.get(TestService) as TestService;
      expect(service.getValue()).toBe(42);
    });

    it('should throw for unregistered token', () => {
      class Unknown {}
      expect(() => testingModule.get(Unknown)).toThrow(/not found/);
    });
  });

  describe('has', () => {
    it('should return true for registered token', () => {
      expect(testingModule.has(TestService)).toBe(true);
    });

    it('should return false for unregistered token', () => {
      class Unknown {}
      expect(testingModule.has(Unknown)).toBe(false);
    });
  });
});
