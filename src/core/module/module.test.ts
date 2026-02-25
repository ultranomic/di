import { describe, expect, it } from 'vitest';
import { Container } from '../container/container.ts';
import type { ContainerInterface } from '../container/interfaces.ts';
import type { DepsTokens } from '../types/deps.ts';
import type { ModuleConstructor } from './interfaces.ts';
import type { ModuleMetadata } from './module.ts';
import { Module } from './module.ts';

describe('Module', () => {
  describe('static metadata', () => {
    it('should allow defining static metadata on a module', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [],
          exports: [],
        };
      }

      expect(TestModule.metadata).toBeDefined();
      expect(TestModule.metadata?.providers).toEqual([]);
      expect(TestModule.metadata?.exports).toEqual([]);
    });

    it('should allow providers in metadata', () => {
      class ServiceA {
        static readonly inject = [] as const satisfies DepsTokens<ServiceA>;
        getValue() {
          return 'a';
        }
      }
      class ServiceB {
        static readonly inject = [] as const satisfies DepsTokens<ServiceB>;
        getValue() {
          return 'b';
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [ServiceA, ServiceB],
        };
      }

      expect(TestModule.metadata?.providers).toContain(ServiceA);
      expect(TestModule.metadata?.providers).toContain(ServiceB);
    });

    it('should allow exports in metadata', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceA', 'ServiceB'],
        };
      }

      expect(TestModule.metadata?.exports).toContain('ServiceA');
      expect(TestModule.metadata?.exports).toContain('ServiceB');
    });

    it('should allow imports in metadata', () => {
      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {};
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [DatabaseModule],
        };
      }

      expect(UserModule.metadata?.imports).toContain(DatabaseModule);
    });

    it('should allow controllers in metadata', () => {
      class UserController {
        static readonly inject = [] as const satisfies DepsTokens<UserController>;
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          controllers: [UserController],
        };
      }

      expect(TestModule.metadata?.controllers).toContain(UserController);
    });

    it('should allow empty metadata', () => {
      class EmptyModule extends Module {}

      expect(EmptyModule.metadata).toBeUndefined();
    });
  });

  describe('register method', () => {
    it('should allow registering providers with container', () => {
      class Service {
        static readonly inject = [] as const satisfies DepsTokens<Service>;
        getValue() {
          return 42;
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Service],
        };
      }

      const container = new Container();
      const module = new TestModule();
      module.register(container);

      expect(container.has(Service)).toBe(true);
      const service = container.resolve(Service);
      expect(service.getValue()).toBe(42);
    });

    it('should allow registering multiple providers', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<Logger>;
        log(_msg: string) {}
      }
      class Database {
        static readonly inject = [] as const satisfies DepsTokens<Database>;
        query() {
          return [];
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Logger, Database],
        };
      }

      const container = new Container();
      const module = new TestModule();
      module.register(container);

      expect(container.has(Logger)).toBe(true);
      expect(container.has(Database)).toBe(true);
    });

    it('should allow registering with dependencies', () => {
      class Config {
        static readonly inject = [] as const satisfies DepsTokens<Config>;
        getPort() {
          return 3000;
        }
      }

      class Server {
        static readonly inject = [Config] as const satisfies DepsTokens<Server>;
        constructor(private config: Config) {}
        getPort() {
          return this.config.getPort();
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Config, Server],
          exports: [Config, Server],
        };
      }

      const container = new Container();
      const module = new TestModule();
      module.register(container);

      const server = container.resolve(Server);
      expect(server.getPort()).toBe(3000);
    });
  });

  describe('ModuleConstructor type', () => {
    it('should work with ModuleConstructor type', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [],
        };
      }

      const ModuleClass: ModuleConstructor = TestModule;
      expect(ModuleClass.metadata?.providers).toEqual([]);
      expect(() => new ModuleClass()).not.toThrow();
    });
  });

  describe('getExportedTokens', () => {
    it('should return exported tokens from metadata', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceA', 'ServiceB'],
        };
      }

      const module = new TestModule();
      const exportedTokens = module.getExportedTokens();

      expect(exportedTokens).toEqual(['ServiceA', 'ServiceB']);
    });

    it('should return empty array when no exports defined', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};
      }

      const module = new TestModule();
      const exportedTokens = module.getExportedTokens();

      expect(exportedTokens).toEqual([]);
    });

    it('should return empty array when metadata is undefined', () => {
      class TestModule extends Module {}

      const module = new TestModule();
      const exportedTokens = module.getExportedTokens();

      expect(exportedTokens).toEqual([]);
    });

    it('should return a copy of the exports array', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceA'],
        };
      }

      const module = new TestModule();
      const exportedTokens1 = module.getExportedTokens();
      const exportedTokens2 = module.getExportedTokens();

      expect(exportedTokens1).not.toBe(exportedTokens2);
      expect(exportedTokens1).toEqual(exportedTokens2);
    });
  });

  describe('lifecycle hooks', () => {
    describe('onModuleInit', () => {
      it('should have default onModuleInit implementation', () => {
        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
        }

        const module = new TestModule();
        // Default implementation returns void, not a Promise
        expect(module.onModuleInit()).toBeUndefined();
      });

      it('should allow overriding onModuleInit', async () => {
        let initialized = false;

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};

          override async onModuleInit(): Promise<void> {
            initialized = true;
          }
        }

        const module = new TestModule();
        await module.onModuleInit();

        expect(initialized).toBe(true);
      });
    });

    describe('onModuleDestroy', () => {
      it('should have default onModuleDestroy implementation', () => {
        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
        }

        const module = new TestModule();
        // Default implementation returns void, not a Promise
        expect(module.onModuleDestroy()).toBeUndefined();
      });

      it('should allow overriding onModuleDestroy', async () => {
        let destroyed = false;

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};

          override async onModuleDestroy(): Promise<void> {
            destroyed = true;
          }
        }

        const module = new TestModule();
        await module.onModuleDestroy();

        expect(destroyed).toBe(true);
      });
    });
  });

  describe('Auto-Registration', () => {
    describe('providers', () => {
      it('should auto-register providers from metadata', () => {
        class TestService {
          static readonly inject = [] as const satisfies DepsTokens<TestService>;
          getValue() {
            return 'test-value';
          }
        }

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            providers: [TestService],
          };
        }

        const container = new Container();
        const module = new TestModule();
        module.register(container);

        // Provider should be registered with the class itself as the token
        expect(container.has(TestService)).toBe(true);
        const service = container.resolve(TestService);
        expect(service.getValue()).toBe('test-value');
      });

      it('should auto-register multiple providers from metadata', () => {
        class ServiceA {
          static readonly inject = [] as const satisfies DepsTokens<ServiceA>;
          getName() {
            return 'A';
          }
        }

        class ServiceB {
          static readonly inject = [] as const satisfies DepsTokens<ServiceB>;
          getName() {
            return 'B';
          }
        }

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            providers: [ServiceA, ServiceB],
          };
        }

        const container = new Container();
        const module = new TestModule();
        module.register(container);

        expect(container.has(ServiceA)).toBe(true);
        expect(container.has(ServiceB)).toBe(true);

        const serviceA = container.resolve(ServiceA);
        const serviceB = container.resolve(ServiceB);

        expect(serviceA.getName()).toBe('A');
        expect(serviceB.getName()).toBe('B');
      });

      it('should allow manual registration to coexist with auto-registration', () => {
        class AutoService {
          static readonly inject = [] as const satisfies DepsTokens<AutoService>;
          isAuto() {
            return true;
          }
        }

        class ManualService {
          static readonly inject = [] as const satisfies DepsTokens<ManualService>;
          isManual() {
            return true;
          }
        }

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            providers: [AutoService],
          };

          override register(container: ContainerInterface): void {
            // Call super for auto-registration
            super.register(container);
            // Manual registration still works
            container.register(ManualService);
          }
        }

        const container = new Container();
        const module = new TestModule();
        module.register(container);

        // Both auto-registered and manual providers should be available
        expect(container.has(AutoService)).toBe(true);
        expect(container.has(ManualService)).toBe(true);

        const autoService = container.resolve(AutoService);
        const manualService = container.resolve(ManualService);

        expect(autoService.isAuto()).toBe(true);
        expect(manualService.isManual()).toBe(true);
      });

      it('should auto-register provider with dependencies', () => {
        class ConfigService {
          static readonly inject = [] as const satisfies DepsTokens<ConfigService>;
          getPort() {
            return 3000;
          }
        }

        class ServerService {
          static readonly inject = [ConfigService] as const satisfies DepsTokens<ServerService>;
          constructor(private config: ConfigService) {}
          getPort() {
            return this.config.getPort();
          }
        }

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            providers: [ConfigService, ServerService],
          };
        }

        const container = new Container();
        const module = new TestModule();
        module.register(container);

        expect(container.has(ConfigService)).toBe(true);
        expect(container.has(ServerService)).toBe(true);

        const server = container.resolve(ServerService);
        expect(server.getPort()).toBe(3000);
      });
    });

    describe('controllers', () => {
      it('should auto-register controllers from metadata', () => {
        class TestController {
          static readonly inject = [] as const satisfies DepsTokens<TestController>;
          handle() {
            return 'handled';
          }
        }

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            controllers: [TestController],
          };
        }

        const container = new Container();
        const module = new TestModule();
        module.register(container);

        // Controller should be registered with the class itself as the token
        expect(container.has(TestController)).toBe(true);
        const controller = container.resolve(TestController);
        expect(controller.handle()).toBe('handled');
      });

      it('should auto-register multiple controllers from metadata', () => {
        class UserController {
          static readonly inject = [] as const satisfies DepsTokens<UserController>;
          route() {
            return 'users';
          }
        }

        class PostController {
          static readonly inject = [] as const satisfies DepsTokens<PostController>;
          route() {
            return 'posts';
          }
        }

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            controllers: [UserController, PostController],
          };
        }

        const container = new Container();
        const module = new TestModule();
        module.register(container);

        expect(container.has(UserController)).toBe(true);
        expect(container.has(PostController)).toBe(true);

        const userController = container.resolve(UserController);
        const postController = container.resolve(PostController);

        expect(userController.route()).toBe('users');
        expect(postController.route()).toBe('posts');
      });
    });

    describe('providers and controllers together', () => {
      it('should auto-register both providers and controllers from metadata', () => {
        class LoggerService {
          static readonly inject = [] as const satisfies DepsTokens<LoggerService>;
          log(msg: string) {
            return `logged: ${msg}`;
          }
        }

        class HomeController {
          static readonly inject = [LoggerService] as const satisfies DepsTokens<HomeController>;
          constructor(private logger: LoggerService) {}
          index() {
            return this.logger.log('home');
          }
        }

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            providers: [LoggerService],
            controllers: [HomeController],
          };
        }

        const container = new Container();
        const module = new TestModule();
        module.register(container);

        expect(container.has(LoggerService)).toBe(true);
        expect(container.has(HomeController)).toBe(true);

        const controller = container.resolve(HomeController);
        expect(controller.index()).toBe('logged: home');
      });
    });

    describe('edge cases', () => {
      it('should handle empty providers array', () => {
        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            providers: [],
          };
        }

        const container = new Container();
        const module = new TestModule();
        expect(() => module.register(container)).not.toThrow();
      });

      it('should handle empty controllers array', () => {
        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            controllers: [],
          };
        }

        const container = new Container();
        const module = new TestModule();
        expect(() => module.register(container)).not.toThrow();
      });

      it('should handle module without metadata', () => {
        class TestModule extends Module {}

        const container = new Container();
        const module = new TestModule();
        expect(() => module.register(container)).not.toThrow();
      });

      it('should handle metadata with undefined providers', () => {
        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
        }

        const container = new Container();
        const module = new TestModule();
        expect(() => module.register(container)).not.toThrow();
      });
    });
  });
});
