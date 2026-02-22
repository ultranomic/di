import { describe, expect, it } from 'vitest'
import { Module } from '../../src/module/module.js'
import type { ModuleMetadata } from '../../src/module/module.js'
import type { ModuleConstructor } from '../../src/module/interfaces.js'
import { Container } from '../../src/container/container.js'

describe('Module', () => {
  describe('static metadata', () => {
    it('should allow defining static metadata on a module', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [],
          exports: [],
        }

        register(_container: Container) {}
      }

      expect(TestModule.metadata).toBeDefined()
      expect(TestModule.metadata?.providers).toEqual([])
      expect(TestModule.metadata?.exports).toEqual([])
    })

    it('should allow providers in metadata', () => {
      class ServiceA {
        getValue() {
          return 'a'
        }
      }
      class ServiceB {
        getValue() {
          return 'b'
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [ServiceA, ServiceB],
        }

        register(_container: Container) {}
      }

      expect(TestModule.metadata?.providers).toContain(ServiceA)
      expect(TestModule.metadata?.providers).toContain(ServiceB)
    })

    it('should allow exports in metadata', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceA', 'ServiceB'],
        }

        register(_container: Container) {}
      }

      expect(TestModule.metadata?.exports).toContain('ServiceA')
      expect(TestModule.metadata?.exports).toContain('ServiceB')
    })

    it('should allow imports in metadata', () => {
      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {}
        register(_container: Container) {}
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [DatabaseModule],
        }

        register(_container: Container) {}
      }

      expect(UserModule.metadata?.imports).toContain(DatabaseModule)
    })

    it('should allow controllers in metadata', () => {
      class UserController {}

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          controllers: [UserController],
        }

        register(_container: Container) {}
      }

      expect(TestModule.metadata?.controllers).toContain(UserController)
    })

    it('should allow empty metadata', () => {
      class EmptyModule extends Module {
        register(_container: Container) {}
      }

      expect(EmptyModule.metadata).toBeUndefined()
    })
  })

  describe('register method', () => {
    it('should allow registering providers with container', () => {
      class Service {
        getValue() {
          return 42
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Service],
        }

        register(container: Container) {
          container.register('Service', () => new Service())
        }
      }

      const container = new Container()
      const module = new TestModule()
      module.register(container)

      expect(container.has('Service')).toBe(true)
      const service = container.resolve('Service') as Service
      expect(service.getValue()).toBe(42)
    })

    it('should allow registering multiple providers', () => {
      class Logger {
        log(_msg: string) {}
      }
      class Database {
        query() {
          return []
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Logger, Database],
        }

        register(container: Container) {
          container.register('Logger', () => new Logger())
          container.register('Database', () => new Database())
        }
      }

      const container = new Container()
      const module = new TestModule()
      module.register(container)

      expect(container.has('Logger')).toBe(true)
      expect(container.has('Database')).toBe(true)
    })

    it('should allow registering with dependencies', () => {
      class Config {
        getPort() {
          return 3000
        }
      }

      class Server {
        static readonly inject = { config: 'Config' } as const
        constructor(private deps: typeof Server.inject) {}

        getPort() {
          return this.deps.config.getPort()
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Config, Server],
          exports: ['Config', 'Server'],
        }

        register(container: Container) {
          container.register('Config', () => new Config()).asSingleton()
          container.register('Server', (c) => {
            const server = new Server({
              config: c.resolve('Config'),
            })
            return server
          })
        }
      }

      const container = new Container()
      const module = new TestModule()
      module.register(container)

      const server = container.resolve('Server') as Server
      expect(server.getPort()).toBe(3000)
    })
  })

  describe('ModuleConstructor type', () => {
    it('should work with ModuleConstructor type', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [],
        }

        register(_container: Container) {}
      }

      const ModuleClass: ModuleConstructor = TestModule
      expect(ModuleClass.metadata?.providers).toEqual([])
      expect(() => new ModuleClass()).not.toThrow()
    })
  })
})
