import { describe, expect, it, beforeEach } from 'vitest'
import { ModuleRegistry } from '../../src/module/registry.js'
import { Module } from '../../src/module/module.js'
import type { ModuleMetadata } from '../../src/module/module.js'
import { Container } from '../../src/container/container.js'

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry
  let container: Container

  beforeEach(() => {
    registry = new ModuleRegistry()
    container = new Container()
  })

  describe('register', () => {
    it('should register a single module', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {}
        register(_container: Container): void {}
      }

      registry.register(TestModule)
      registry.loadModules(container)

      expect(registry.isLoaded(TestModule)).toBe(true)
    })

    it('should register multiple modules', () => {
      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {}
        register(_container: Container): void {}
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {}
        register(_container: Container): void {}
      }

      registry.register(ModuleA)
      registry.register(ModuleB)
      registry.loadModules(container)

      expect(registry.isLoaded(ModuleA)).toBe(true)
      expect(registry.isLoaded(ModuleB)).toBe(true)
    })

    it('should handle duplicate registration', () => {
      let registerCount = 0

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {}
        register(_container: Container): void {
          registerCount++
        }
      }

      registry.register(TestModule)
      registry.register(TestModule)
      registry.loadModules(container)

      expect(registerCount).toBe(1)
    })
  })

  describe('loadModules', () => {
    it('should load modules and register providers with container', () => {
      class Logger {
        log() {
          return 'logged'
        }
      }

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {
          providers: [Logger],
        }

        register(container: Container): void {
          container.register('Logger', () => new Logger())
        }
      }

      registry.register(TestModule)
      registry.loadModules(container)

      expect(container.has('Logger')).toBe(true)
      const logger = container.resolve('Logger') as Logger
      expect(logger.log()).toBe('logged')
    })

    it('should load multiple modules with different providers', () => {
      class Logger {
        log() {
          return 'logged'
        }
      }

      class Database {
        query() {
          return []
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['Logger'],
        }

        register(container: Container): void {
          container.register('Logger', () => new Logger())
        }
      }

      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['Database'],
        }

        register(container: Container): void {
          container.register('Database', () => new Database())
        }
      }

      registry.register(LoggerModule)
      registry.register(DatabaseModule)
      registry.loadModules(container)

      expect(container.has('Logger')).toBe(true)
      expect(container.has('Database')).toBe(true)
    })
  })

  describe('import resolution', () => {
    it('should load imported modules before the module that imports them', () => {
      const loadOrder: string[] = []

      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {}

        register(_container: Container): void {
          loadOrder.push('DatabaseModule')
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [DatabaseModule],
        }

        register(_container: Container): void {
          loadOrder.push('UserModule')
        }
      }

      registry.register(UserModule)
      registry.loadModules(container)

      expect(loadOrder).toEqual(['DatabaseModule', 'UserModule'])
    })

    it('should handle nested imports', () => {
      const loadOrder: string[] = []

      class ConfigModule extends Module {
        static readonly metadata: ModuleMetadata = {}

        register(_container: Container): void {
          loadOrder.push('ConfigModule')
        }
      }

      class DatabaseModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ConfigModule],
        }

        register(_container: Container): void {
          loadOrder.push('DatabaseModule')
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [DatabaseModule],
        }

        register(_container: Container): void {
          loadOrder.push('UserModule')
        }
      }

      registry.register(UserModule)
      registry.loadModules(container)

      expect(loadOrder).toEqual(['ConfigModule', 'DatabaseModule', 'UserModule'])
    })

    it('should handle shared imports (diamond dependency)', () => {
      const loadOrder: string[] = []

      class SharedModule extends Module {
        static readonly metadata: ModuleMetadata = {}

        register(_container: Container): void {
          loadOrder.push('SharedModule')
        }
      }

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SharedModule],
        }

        register(_container: Container): void {
          loadOrder.push('ModuleA')
        }
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [SharedModule],
        }

        register(_container: Container): void {
          loadOrder.push('ModuleB')
        }
      }

      class AppModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA, ModuleB],
        }

        register(_container: Container): void {
          loadOrder.push('AppModule')
        }
      }

      registry.register(AppModule)
      registry.loadModules(container)

      expect(loadOrder).toEqual(['SharedModule', 'ModuleA', 'ModuleB', 'AppModule'])
    })

    it('should handle circular imports without infinite recursion', () => {
      const loadOrder: string[] = []

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {}

        register(_container: Container): void {
          loadOrder.push('ModuleA')
        }
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA],
        }

        register(_container: Container): void {
          loadOrder.push('ModuleB')
        }
      }

      ;(ModuleA as typeof Module & { metadata: ModuleMetadata }).metadata = {
        imports: [ModuleB],
      }
      registry.register(ModuleA)
      registry.loadModules(container)
      expect(loadOrder.filter((m) => m === 'ModuleA')).toHaveLength(1)
      expect(loadOrder.filter((m) => m === 'ModuleB')).toHaveLength(1)
    })

    it('should make imported providers available to importing module', () => {
      class Logger {
        log() {
          return 'logged'
        }
      }

      class LoggerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['Logger'],
        }

        register(container: Container): void {
          container.register('Logger', () => new Logger()).asSingleton()
        }
      }

      class UserService {
        static readonly inject = { logger: 'Logger' } as const
        constructor(private deps: typeof UserService.inject) {}

        logSomething() {
          return (this.deps.logger as unknown as Logger).log()
        }
      }

      class UserModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [LoggerModule],
          providers: [UserService],
        }

        register(container: Container): void {
          container
            .register('UserService', (c) => new UserService({ logger: c.resolve('Logger') }))
            .asSingleton()
        }
      }

      registry.register(UserModule)
      registry.loadModules(container)

      const userService = container.resolve('UserService') as UserService
      expect(userService.logSomething()).toBe('logged')
    })
  })

  describe('loadModule', () => {
    it('should load a single module directly', () => {
      let wasRegistered = false

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {}

        register(_container: Container): void {
          wasRegistered = true
        }
      }

      registry.loadModule(TestModule, container)

      expect(wasRegistered).toBe(true)
      expect(registry.isLoaded(TestModule)).toBe(true)
    })

    it('should not reload an already loaded module', () => {
      let registerCount = 0

      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {}

        register(_container: Container): void {
          registerCount++
        }
      }

      registry.loadModule(TestModule, container)
      registry.loadModule(TestModule, container)

      expect(registerCount).toBe(1)
    })
  })

  describe('isLoaded', () => {
    it('should return false for unloaded module', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {}
        register(_container: Container): void {}
      }

      expect(registry.isLoaded(TestModule)).toBe(false)
    })

    it('should return true for loaded module', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {}
        register(_container: Container): void {}
      }

      registry.loadModule(TestModule, container)

      expect(registry.isLoaded(TestModule)).toBe(true)
    })
  })

  describe('clear', () => {
    it('should clear all registered and loaded modules', () => {
      class TestModule extends Module {
        static readonly metadata: ModuleMetadata = {}
        register(_container: Container): void {}
      }

      registry.register(TestModule)
      registry.loadModules(container)

      expect(registry.isLoaded(TestModule)).toBe(true)

      registry.clear()

      expect(registry.isLoaded(TestModule)).toBe(false)
    })
  })
})
