import { beforeEach, describe, expect, it } from 'vitest';
import { Container } from '../container/container.ts';
import type { ContainerInterface } from '../container/interfaces.ts';
import type { ModuleMetadata } from './module.ts';
import { Module } from './module.ts';
import { ModuleRegistry } from './registry.ts';

describe('ModuleContainer Coverage Tests', () => {
  let registry: ModuleRegistry;
  let container: Container;

  beforeEach(() => {
    registry = new ModuleRegistry();
    container = new Container();
  });

  describe('getAccessibleTokens with exported tokens from imported modules (line 110)', () => {
    it('should include exported tokens from imported modules in accessible tokens', async () => {
      // ModuleA exports a service
      class ExportedService {
        getValue() {
          return 'from A';
        }
      }

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ExportedService'],
        };

        register(c: ContainerInterface): void {
          c.register('ExportedService', () => new ExportedService());
        }
      }

      // ModuleB imports ModuleA and uses the exported service
      class ConsumerService {
        private dep: ExportedService;
        constructor(dep: ExportedService) {
          this.dep = dep;
        }
        useDep() {
          return this.dep.getValue();
        }
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA],
        };

        register(c: ContainerInterface): void {
          // This should succeed because ExportedService is exported from ModuleA
          c.register('ConsumerService', (res) => new ConsumerService(res.resolve('ExportedService')));
        }
      }

      registry.register(ModuleB);
      await registry.loadModules(container);

      // Verify the service can be resolved (meaning the token was accessible)
      const consumer = container.resolve('ConsumerService') as ConsumerService;
      expect(consumer.useDep()).toBe('from A');
    });

    it('should not allow access to non-exported tokens from imported modules', async () => {
      // ModuleA has a service that is NOT exported
      class PrivateService {
        getValue() {
          return 'private';
        }
      }

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          // No exports - PrivateService is private
        };

        register(c: ContainerInterface): void {
          c.register('PrivateService', () => new PrivateService());
        }
      }

      // ModuleB imports ModuleA and tries to use PrivateService
      class ConsumerService {
        private dep: PrivateService;
        constructor(dep: PrivateService) {
          this.dep = dep;
        }
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA],
        };

        register(c: ContainerInterface): void {
          // This tries to use the private service from ModuleA
          c.register('ConsumerService', (res) => new ConsumerService(res.resolve('PrivateService')));
        }
      }

      registry.register(ModuleB);

      let error: Error | undefined;
      try {
        await registry.loadModules(container);
      } catch (e) {
        error = e as Error;
      }

      // Should throw NonExportedTokenError
      expect(error).toBeDefined();
      expect(error?.name).toBe('NonExportedTokenError');
      expect(error?.message).toContain('PrivateService');
    });

    it('should handle multiple imported modules with exported tokens', async () => {
      // ModuleA exports ServiceA
      class ServiceA {
        name = 'A';
      }

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceA'],
        };

        register(c: ContainerInterface): void {
          c.register('ServiceA', () => new ServiceA());
        }
      }

      // ModuleB exports ServiceB
      class ServiceB {
        name = 'B';
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceB'],
        };

        register(c: ContainerInterface): void {
          c.register('ServiceB', () => new ServiceB());
        }
      }

      // ModuleC imports both ModuleA and ModuleB
      class AggregateService {
        private serviceA: ServiceA;
        private serviceB: ServiceB;
        constructor(a: ServiceA, b: ServiceB) {
          this.serviceA = a;
          this.serviceB = b;
        }
        getNames() {
          return `${this.serviceA.name}${this.serviceB.name}`;
        }
      }

      class ModuleC extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA, ModuleB],
        };

        register(c: ContainerInterface): void {
          c.register('AggregateService', (res) =>
            new AggregateService(res.resolve('ServiceA'), res.resolve('ServiceB'))
          );
        }
      }

      registry.register(ModuleC);
      await registry.loadModules(container);

      const aggregate = container.resolve('AggregateService') as AggregateService;
      expect(aggregate.getNames()).toBe('AB');
    });

    it('should handle module with both exported and private tokens', async () => {
      // ModuleA has both exported and private services
      class PublicService {
        type = 'public';
      }

      class PrivateService {
        type = 'private';
      }

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['PublicService'], // Only PublicService is exported
        };

        register(c: ContainerInterface): void {
          c.register('PublicService', () => new PublicService());
          c.register('PrivateService', () => new PrivateService());
        }
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA],
        };

        register(c: ContainerInterface): void {
          // Should be able to register using exported service
          c.register('PublicConsumer', (res) => {
            const pub = res.resolve('PublicService');
            return { publicType: (pub as PublicService).type };
          });
        }
      }

      // ModuleB should load successfully with access to exported service
      registry.register(ModuleB);
      await registry.loadModules(container);
      const publicConsumer = container.resolve('PublicConsumer') as { publicType: string };
      expect(publicConsumer.publicType).toBe('public');
    });

    it('should handle transitive exports (A exports to B, B exports to C)', async () => {
      // ModuleA exports BaseService
      class BaseService {
        level = 1;
      }

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['BaseService'],
        };

        register(c: ContainerInterface): void {
          c.register('BaseService', () => new BaseService());
        }
      }

      // ModuleB imports ModuleA and re-exports BaseService (conceptually)
      // and adds DerivedService
      class DerivedService {
        base: BaseService;
        constructor(base: BaseService) {
          this.base = base;
        }
        getLevel() {
          return this.base.level + 1;
        }
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA],
          exports: ['BaseService', 'DerivedService'],
        };

        register(c: ContainerInterface): void {
          c.register('DerivedService', (res) => new DerivedService(res.resolve('BaseService')));
        }
      }

      // ModuleC imports ModuleB
      class ModuleC extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleB],
        };

        register(c: ContainerInterface): void {
          c.register('FinalService', (res) => {
            const derived = res.resolve('DerivedService') as DerivedService;
            return { level: derived.getLevel() };
          });
        }
      }

      registry.register(ModuleC);
      await registry.loadModules(container);

      const final = container.resolve('FinalService') as { level: number };
      expect(final.level).toBe(2);
    });

    it('should track token ownership correctly across modules', async () => {
      class ServiceX {
        name = 'X';
      }

      class ServiceY {
        name = 'Y';
      }

      class ModuleX extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceX'],
        };

        register(c: ContainerInterface): void {
          c.register('ServiceX', () => new ServiceX());
        }
      }

      class ModuleY extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: ['ServiceY'],
        };

        register(c: ContainerInterface): void {
          c.register('ServiceY', () => new ServiceY());
        }
      }

      // MainModule imports both
      class MainModule extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleX, ModuleY],
        };

        register(c: ContainerInterface): void {
          c.register('CombinedService', (res) => {
            const x = res.resolve('ServiceX') as ServiceX;
            const y = res.resolve('ServiceY') as ServiceY;
            return { names: `${x.name}${y.name}` };
          });
        }
      }

      registry.register(MainModule);
      await registry.loadModules(container);

      const combined = container.resolve('CombinedService') as { names: string };
      expect(combined.names).toBe('XY');
    });
  });

  describe('edge cases for token accessibility', () => {
    it('should allow module to access its own tokens regardless of exports', async () => {
      class PrivateService {
        secret = 'private';
      }

      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          // NOT exported
        };

        register(c: ContainerInterface): void {
          c.register('PrivateService', () => new PrivateService());
          // Module should be able to use its own private service
          c.register('PublicService', (res) => {
            const priv = res.resolve('PrivateService') as PrivateService;
            return { derived: priv.secret };
          });
        }
      }

      registry.register(ModuleA);
      await registry.loadModules(container);

      const pub = container.resolve('PublicService') as { derived: string };
      expect(pub.derived).toBe('private');
    });

    it('should handle empty exports array', async () => {
      class ModuleA extends Module {
        static readonly metadata: ModuleMetadata = {
          exports: [], // Explicitly empty
        };

        register(_c: ContainerInterface): void {}
      }

      class ModuleB extends Module {
        static readonly metadata: ModuleMetadata = {
          imports: [ModuleA],
        };

        register(_c: ContainerInterface): void {}
      }

      registry.register(ModuleB);
      await registry.loadModules(container);

      // Should complete without errors even though ModuleA has no exports
      expect(registry.isLoaded(ModuleA)).toBe(true);
      expect(registry.isLoaded(ModuleB)).toBe(true);
    });
  });
});
