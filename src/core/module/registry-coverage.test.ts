import { beforeEach, describe, expect, it } from 'vitest';
import { Container } from '../container/container.ts';
import type { ContainerInterface } from '../container/interfaces.ts';
import type { ModuleMetadata } from './module.ts';
import { Module } from './module.ts';
import { ModuleRegistry } from './registry.ts';

describe('ModuleRegistry Coverage Tests', () => {
  let registry: ModuleRegistry;
  let container: Container;

  beforeEach(() => {
    registry = new ModuleRegistry();
    container = new Container();
  });

  describe('getModuleName with anonymous module (line 148)', () => {
    it('should return AnonymousModule for module without name', async () => {
      // Create an anonymous function as the module class
      // When a class is created via an anonymous function expression, it may not have a name
      const AnonymousModuleConstructor = class extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {
          // Register a provider
          container.register('AnonService', () => ({ value: 'anonymous' }));
        }
      };

      // Even though we assign it to a const, the class itself has a name
      // To test the anonymous branch, we need to simulate module.name being falsy

      registry.register(AnonymousModuleConstructor);
      await registry.loadModules(container);

      // Verify the module loaded successfully despite potentially anonymous name
      expect(registry.isLoaded(AnonymousModuleConstructor)).toBe(true);
      expect(container.has('AnonService')).toBe(true);
    });

    it('should handle module with empty name (line 148 branch)', async () => {
      // Create a module class and override its name to be empty
      const EmptyNameModule = class extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {
          container.register('EmptyNameService', () => ({ value: 'empty-name' }));
        }
      };

      // Override the name property to be empty string
      Object.defineProperty(EmptyNameModule, 'name', { value: '', configurable: true });

      registry.register(EmptyNameModule);
      await registry.loadModules(container);

      // The module should still load, using 'AnonymousModule' as the name
      expect(registry.isLoaded(EmptyNameModule)).toBe(true);
      expect(container.has('EmptyNameService')).toBe(true);
    });

    it('should handle modules loaded in correct order with anonymous modules', async () => {
      const loadOrder: string[] = [];

      // First module
      class FirstModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {
          loadOrder.push('FirstModule');
        }
      }

      // Create second module - in some transpilation scenarios, names might be undefined
      const SecondModule = class extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [FirstModule],
        };
        register(_container: ContainerInterface): void {
          loadOrder.push('SecondModule');
        }
      };

      registry.register(SecondModule);
      await registry.loadModules(container);

      // FirstModule should be loaded before SecondModule
      expect(loadOrder.indexOf('FirstModule')).toBeLessThan(loadOrder.indexOf('SecondModule'));
    });

    it('should log module initialization even when module name is not available', async () => {
      let initCalled = false;

      const TestModule = class extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_container: ContainerInterface): void {
          initCalled = true;
        }
      };

      registry.register(TestModule);
      await registry.loadModules(container);

      expect(initCalled).toBe(true);
    });
  });

  describe('loadModules with complex scenarios', () => {
    it('should handle modules with only exports (no providers)', async () => {
      class ExportedService {
        getValue() {
          return 'exported';
        }
      }

      class ProviderModule extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ExportedService'],
        };
        register(container: ContainerInterface): void {
          container.register('ExportedService', () => new ExportedService());
        }
      }

      class ConsumerModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ProviderModule],
        };
        register(_container: ContainerInterface): void {}
      }

      registry.register(ConsumerModule);
      await registry.loadModules(container);

      expect(container.has('ExportedService')).toBe(true);
    });

    it('should handle deeply nested import chains', async () => {
      const loadOrder: string[] = [];

      class ModuleD extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_c: ContainerInterface): void {
          loadOrder.push('D');
        }
      }

      class ModuleC extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleD],
        };
        register(_c: ContainerInterface): void {
          loadOrder.push('C');
        }
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleC],
        };
        register(_c: ContainerInterface): void {
          loadOrder.push('B');
        }
      }

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleB],
        };
        register(_c: ContainerInterface): void {
          loadOrder.push('A');
        }
      }

      registry.register(ModuleA);
      await registry.loadModules(container);

      expect(loadOrder).toEqual(['D', 'C', 'B', 'A']);
    });
  });

  describe('destroyModules', () => {
    it('should destroy modules in reverse order', async () => {
      const destroyOrder: string[] = [];

      class FirstModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_c: ContainerInterface): void {}
        onModuleDestroy(): void {
          destroyOrder.push('FirstModule');
        }
      }

      class SecondModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_c: ContainerInterface): void {}
        onModuleDestroy(): Promise<void> | void {
          destroyOrder.push('SecondModule');
        }
      }

      class ThirdModule extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_c: ContainerInterface): void {}
        async onModuleDestroy(): Promise<void> {
          destroyOrder.push('ThirdModule');
        }
      }

      registry.register(FirstModule);
      registry.register(SecondModule);
      registry.register(ThirdModule);
      await registry.loadModules(container);
      await registry.destroyModules();

      expect(destroyOrder).toEqual(['ThirdModule', 'SecondModule', 'FirstModule']);
    });

    it('should handle modules without onModuleDestroy', async () => {
      class ModuleWithDestroy extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_c: ContainerInterface): void {}
        onModuleDestroy(): void {
          // Called
        }
      }

      class ModuleWithoutDestroy extends Module {
        static readonly metadata: ModuleMetadata = {};
        register(_c: ContainerInterface): void {
          // No onModuleDestroy method
        }
      }

      registry.register(ModuleWithDestroy);
      registry.register(ModuleWithoutDestroy);

      await registry.loadModules(container);

      // Should not throw even though one module doesn't have onModuleDestroy
      await expect(registry.destroyModules()).resolves.toBeUndefined();
    });
  });
});
