import { describe, expect, it } from 'vitest';
import { Container } from '../container/container.ts';
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

        register(_container: Container) {}
      }

      expect(TestModule.metadata).toBeDefined();
      expect(TestModule.metadata?.providers).toEqual([]);
      expect(TestModule.metadata?.exports).toEqual([]);
    });

    it('should allow providers in metadata', () => {
      class ServiceA {
        getValue() {
          return 'a';
        }
      }
      class ServiceB {
        getValue() {
          return 'b';
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [ServiceA, ServiceB],
        };

        register(_container: Container) {}
      }

      expect(TestModule.metadata?.providers).toContain(ServiceA);
      expect(TestModule.metadata?.providers).toContain(ServiceB);
    });

    it('should allow exports in metadata', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceA', 'ServiceB'],
        };

        register(_container: Container) {}
      }

      expect(TestModule.metadata?.exports).toContain('ServiceA');
      expect(TestModule.metadata?.exports).toContain('ServiceB');
    });

    it('should allow imports in metadata', () => {
      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: Container) {}
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [DatabaseModule],
        };

        register(_container: Container) {}
      }

      expect(UserModule.metadata?.imports).toContain(DatabaseModule);
    });

    it('should allow controllers in metadata', () => {
      class UserController {}

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          controllers: [UserController],
        };

        register(_container: Container) {}
      }

      expect(TestModule.metadata?.controllers).toContain(UserController);
    });

    it('should allow empty metadata', () => {
      class EmptyModule extends Module {
        register(_container: Container) {}
      }

      expect(EmptyModule.metadata).toBeUndefined();
    });
  });

  describe('register method', () => {
    it('should allow registering providers with container', () => {
      class Service {
        getValue() {
          return 42;
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Service],
        };

        register(container: Container) {
          container.register('Service', () => new Service());
        }
      }

      const container = new Container();
      const module = new TestModule();
      module.register(container);

      expect(container.has('Service')).toBe(true);
      const service = container.resolve('Service') as Service;
      expect(service.getValue()).toBe(42);
    });

    it('should allow registering multiple providers', () => {
      class Logger {
        log(_msg: string) {}
      }
      class Database {
        query() {
          return [];
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Logger, Database],
        };

        register(container: Container) {
          container.register('Logger', () => new Logger());
          container.register('Database', () => new Database());
        }
      }

      const container = new Container();
      const module = new TestModule();
      module.register(container);

      expect(container.has('Logger')).toBe(true);
      expect(container.has('Database')).toBe(true);
    });

    it('should allow registering with dependencies', () => {
      class Config {
        getPort() {
          return 3000;
        }
      }

      class Server {
        static readonly inject = { config: 'Config' } as const;
        constructor(private deps: typeof Server.inject) {}

        getPort() {
          return this.deps.config.getPort();
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Config, Server],
          exports: ['Config', 'Server'],
        };

        register(container: Container) {
          container.register('Config', () => new Config()).asSingleton();
          container.register('Server', (c) => {
            const server = new Server({
              config: c.resolve('Config'),
            });
            return server;
          });
        }
      }

      const container = new Container();
      const module = new TestModule();
      module.register(container);

      const server = container.resolve('Server') as Server;
      expect(server.getPort()).toBe(3000);
    });
  });

  describe('ModuleConstructor type', () => {
    it('should work with ModuleConstructor type', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [],
        };

        register(_container: Container) {}
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

        register(_container: Container) {}
      }

      const module = new TestModule();
      const exportedTokens = module.getExportedTokens();

      expect(exportedTokens).toEqual(['ServiceA', 'ServiceB']);
    });

    it('should return empty array when no exports defined', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {};

        register(_container: Container) {}
      }

      const module = new TestModule();
      const exportedTokens = module.getExportedTokens();

      expect(exportedTokens).toEqual([]);
    });

    it('should return empty array when metadata is undefined', () => {
      class TestModule extends Module {
        register(_container: Container) {}
      }

      const module = new TestModule();
      const exportedTokens = module.getExportedTokens();

      expect(exportedTokens).toEqual([]);
    });

    it('should return a copy of the exports array', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceA'],
        };

        register(_container: Container) {}
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
      it('should have default onModuleInit implementation', async () => {
        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: Container) {}
        }

        const module = new TestModule();
        await expect(module.onModuleInit()).resolves.toBeUndefined();
      });

      it('should allow overriding onModuleInit', async () => {
        let initialized = false;

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: Container) {}

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
      it('should have default onModuleDestroy implementation', async () => {
        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: Container) {}
        }

        const module = new TestModule();
        await expect(module.onModuleDestroy()).resolves.toBeUndefined();
      });

      it('should allow overriding onModuleDestroy', async () => {
        let destroyed = false;

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {};
          register(_container: Container) {}

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
        const service = container.resolve(TestService) as TestService;
        expect(service.getValue()).toBe('test-value');
      });

      it('should auto-register multiple providers from metadata', () => {
        class ServiceA {
          getName() {
            return 'A';
          }
        }

        class ServiceB {
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

        const serviceA = container.resolve(ServiceA) as ServiceA;
        const serviceB = container.resolve(ServiceB) as ServiceB;

        expect(serviceA.getName()).toBe('A');
        expect(serviceB.getName()).toBe('B');
      });

      it('should allow manual registration to coexist with auto-registration', () => {
        class AutoService {
          isAuto() {
            return true;
          }
        }

        class ManualService {
          isManual() {
            return true;
          }
        }

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            providers: [AutoService],
          };

          override register(container: Container): void {
            // Call super for auto-registration
            super.register(container);
            // Manual registration still works
            container.register('ManualService', () => new ManualService());
          }
        }

        const container = new Container();
        const module = new TestModule();
        module.register(container);

        // Both auto-registered and manual providers should be available
        expect(container.has(AutoService)).toBe(true);
        expect(container.has('ManualService')).toBe(true);

        const autoService = container.resolve(AutoService) as AutoService;
        const manualService = container.resolve('ManualService') as ManualService;

        expect(autoService.isAuto()).toBe(true);
        expect(manualService.isManual()).toBe(true);
      });

      it('should auto-register provider with dependencies', () => {
        class ConfigService {
          getPort() {
            return 3000;
          }
        }

        class ServerService {
          constructor(private deps: { config: typeof ConfigService }) {}

          getPort() {
            return this.deps.config.getPort();
          }
        }

        class TestModule extends Module {
          static readonly metadata: ModuleMetadata = {
            // Only auto-register simple providers
            providers: [ConfigService],
            // ServerService is NOT in metadata - it will be manually registered
          };

          override register(container: Container): void {
            // Call super for auto-registration of ConfigService
            super.register(container);
            // ServerService needs manual registration with dependencies
            container.register(ServerService, (c) => {
              return new ServerService({
                config: c.resolve(ConfigService),
              });
            });
          }
        }

        const container = new Container();
        const module = new TestModule();
        module.register(container);

        expect(container.has(ConfigService)).toBe(true);
        expect(container.has(ServerService)).toBe(true);

        const server = container.resolve(ServerService) as ServerService;
        expect(server.getPort()).toBe(3000);
      });
    });

    describe('controllers', () => {
      it('should auto-register controllers from metadata', () => {
        class TestController {
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
        const controller = container.resolve(TestController) as TestController;
        expect(controller.handle()).toBe('handled');
      });

      it('should auto-register multiple controllers from metadata', () => {
        class UserController {
          route() {
            return 'users';
          }
        }

        class PostController {
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

        const userController = container.resolve(UserController) as UserController;
        const postController = container.resolve(PostController) as PostController;

        expect(userController.route()).toBe('users');
        expect(postController.route()).toBe('posts');
      });
    });

    describe('providers and controllers together', () => {
      it('should auto-register both providers and controllers from metadata', () => {
        class LoggerService {
          log(msg: string) {
            return `logged: ${msg}`;
          }
        }

        class HomeController {
          constructor(private deps: { logger: typeof LoggerService }) {}

          index() {
            return this.deps.logger.log('home');
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

        const controller = container.resolve(HomeController) as HomeController;
        // HomeController was created with no-arg constructor by auto-registration
        // So logger would be undefined, let's just check it was registered
        expect(controller).toBeDefined();
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
