import { describe, expect, it } from 'vite-plus/test';
import { DI_ERROR_CODE } from './di-error.ts';
import { buildGraph } from './graph.ts';
import { Injectable } from './injectable.ts';
import { Module } from './module.ts';
import { SCOPE } from './scope.ts';
import './test-utils.ts';

// ---------------------------------------------------------------------------
// 1. Simple linear graph
// ---------------------------------------------------------------------------
describe('buildGraph — simple linear graph', () => {
  it('returns [B, A] when A depends on B and B has no deps', () => {
    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {}

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
      exports: [ServiceA, ServiceB],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toEqual(['ServiceB', 'ServiceA']);
  });

  it('returns single provider with no deps as-is', () => {
    class Solo extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [Solo],
    }) {}

    const result = buildGraph(AppModule);
    expect(result.sorted).toHaveLength(1);
    expect(result.sorted[0]).toBe(Solo);
  });
});

// ---------------------------------------------------------------------------
// 2. Diamond graph
// ---------------------------------------------------------------------------
describe('buildGraph — diamond graph', () => {
  it('A→B,C; B→D; C→D → D first, A last', () => {
    class ServiceD extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class ServiceC extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceD', ServiceD]],
    }) {}
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceD', ServiceD]],
    }) {}
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [
        ['serviceB', ServiceB],
        ['serviceC', ServiceC],
      ],
    }) {}

    class AppModule extends Module({
      providers: [ServiceA, ServiceB, ServiceC, ServiceD],
      exports: [ServiceA],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    // D must come first, A last. B and C can be in either order between D and A.
    const dIdx = names.indexOf('ServiceD');
    const bIdx = names.indexOf('ServiceB');
    const cIdx = names.indexOf('ServiceC');
    const aIdx = names.indexOf('ServiceA');

    expect(dIdx).toBeLessThan(bIdx);
    expect(dIdx).toBeLessThan(cIdx);
    expect(bIdx).toBeLessThan(aIdx);
    expect(cIdx).toBeLessThan(aIdx);
    expect(names).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 3. Cycle detection (cycles allowed at graph level, resolved at runtime)
// ---------------------------------------------------------------------------
describe('buildGraph — cycle detection', () => {
  it('allows A→B→A cycle (resolved at runtime via proxy)', () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [], // placeholder, will set below
    }) {}
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {}

    // Mutate _inject to create cycle A→B→A
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const result = buildGraph(AppModule);
    expect(result.sorted).toHaveLength(2);
    expect(result.sorted).toContain(ServiceA);
    expect(result.sorted).toContain(ServiceB);
  });

  it('allows self-dependency A→A (resolved at runtime via proxy)', () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [],
    }) {}

    // Force self-dep
    (ServiceA as any)._injectClasses = [ServiceA];

    class AppModule extends Module({
      providers: [ServiceA],
    }) {}

    const result = buildGraph(AppModule);
    expect(result.sorted).toHaveLength(1);
    expect(result.sorted).toContain(ServiceA);
  });

  it('allows longer cycle A→B→C→A (resolved at runtime via proxy)', () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [],
    }) {}
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {}
    class ServiceC extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {}

    (ServiceA as any)._injectClasses = [ServiceC];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB, ServiceC],
    }) {}

    const result = buildGraph(AppModule);
    expect(result.sorted).toHaveLength(3);
  });

  it('allows Transient↔Transient cycle at graph level (throws at runtime)', () => {
    class TransA extends Injectable({ scope: SCOPE.TRANSIENT, inject: [] }) {}
    class TransB extends Injectable({ scope: SCOPE.TRANSIENT, inject: [['transA', TransA]] }) {}

    (TransA as any)._injectClasses = [TransB];

    class AppModule extends Module({
      providers: [TransA, TransB],
    }) {}

    // Graph builds successfully — cycle is detected at runtime
    const result = buildGraph(AppModule);
    expect(result.sorted).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Missing provider
// ---------------------------------------------------------------------------
describe('buildGraph — missing provider', () => {
  it('throws MISSING_PROVIDER when dependency is not in any module', () => {
    class MissingService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['missingService', MissingService]],
    }) {}

    class AppModule extends Module({
      providers: [ServiceA],
    }) {}

    expect(() => buildGraph(AppModule)).toThrowDIError(
      DI_ERROR_CODE.MISSING_PROVIDER,
      /No provider found for MissingService/,
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Scope violation
// ---------------------------------------------------------------------------
describe('buildGraph — scope violation', () => {
  it('throws SCOPE_VIOLATION when Singleton depends on Request-scoped', () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {}
    class SingletonService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['requestService', RequestService]],
    }) {}

    class AppModule extends Module({
      providers: [SingletonService, RequestService],
    }) {}

    expect(() => buildGraph(AppModule)).toThrowDIError(
      DI_ERROR_CODE.SCOPE_VIOLATION,
      /Scope violation: SingletonService \(singleton\) depends on RequestService \(request\)/,
    );
  });

  it('does NOT throw when Singleton depends on Transient', () => {
    class TransientService extends Injectable({ scope: SCOPE.TRANSIENT }) {}
    class SingletonService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['transientService', TransientService]],
    }) {}

    class AppModule extends Module({
      providers: [SingletonService, TransientService],
    }) {}

    const result = buildGraph(AppModule);
    expect(result.sorted).toHaveLength(2);
  });

  it('does NOT throw when Transient depends on Request-scoped', () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {}
    class TransientService extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['requestService', RequestService]],
    }) {}

    class AppModule extends Module({
      providers: [TransientService, RequestService],
    }) {}

    const result = buildGraph(AppModule);
    expect(result.sorted).toHaveLength(2);
  });

  it('throws SCOPE_VIOLATION for transitive scope violation (Singleton→Transient→Request)', () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {}
    class TransientService extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['requestService', RequestService]],
    }) {}
    class SingletonService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['transientService', TransientService]],
    }) {}

    class AppModule extends Module({
      providers: [SingletonService, TransientService, RequestService],
    }) {}

    expect(() => buildGraph(AppModule)).toThrowDIError(
      DI_ERROR_CODE.SCOPE_VIOLATION,
      /Scope violation: SingletonService \(singleton\) transitively depends on a request-scoped provider via TransientService/,
    );
  });

  it('throws SCOPE_VIOLATION for deep transitive violation (Singleton→Transient→Transient→Request)', () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {}
    class TransientB extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['requestService', RequestService]],
    }) {}
    class TransientA extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['transientB', TransientB]],
    }) {}
    class SingletonService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['transientA', TransientA]],
    }) {}

    class AppModule extends Module({
      providers: [SingletonService, TransientA, TransientB, RequestService],
    }) {}

    expect(() => buildGraph(AppModule)).toThrowDIError(
      DI_ERROR_CODE.SCOPE_VIOLATION,
      /Scope violation: SingletonService \(singleton\) transitively depends on a request-scoped provider via TransientA/,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Module imports
// ---------------------------------------------------------------------------
describe('buildGraph — module imports', () => {
  it('providers from imported module are accessible', () => {
    class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class DbService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['configService', ConfigService]],
    }) {}

    class CoreModule extends Module({
      providers: [ConfigService],
      exports: [ConfigService],
    }) {}

    class AppModule extends Module({
      providers: [DbService],
      imports: [CoreModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toEqual(['ConfigService', 'DbService']);
  });

  it('only exported providers from imported module are accessible', () => {
    class PublicService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class PrivateService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class ConsumerService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['publicService', PublicService]],
    }) {}

    class SharedModule extends Module({
      providers: [PublicService, PrivateService],
      exports: [PublicService],
    }) {}

    class AppModule extends Module({
      providers: [ConsumerService],
      imports: [SharedModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toContain('PublicService');
    expect(names).toContain('ConsumerService');
    expect(names).not.toContain('PrivateService');
  });

  it('nested imports: grandchild module providers accessible', () => {
    class DeepService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class MidService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['deepService', DeepService]],
    }) {}
    class TopService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['midService', MidService]],
    }) {}

    class DeepModule extends Module({
      providers: [DeepService],
      exports: [DeepService],
    }) {}

    class MidModule extends Module({
      providers: [MidService],
      exports: [MidService],
      imports: [DeepModule],
    }) {}

    class AppModule extends Module({
      providers: [TopService],
      imports: [MidModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toEqual(['DeepService', 'MidService', 'TopService']);
  });
});

// ---------------------------------------------------------------------------
// 8. Large graph (10+ services)
// ---------------------------------------------------------------------------
describe('buildGraph — large graph', () => {
  it('correctly sorts 10+ services with mixed deps', () => {
    // Build a chain: S1 → S2 → S3 → ... → S10
    const services: any[] = [];
    for (let i = 10; i >= 1; i--) {
      const deps = i < 10 ? ([['dep', services.at(-1)]] as const) : ([] as const);
      const cls = class extends Injectable({
        scope: i % 3 === 0 ? SCOPE.TRANSIENT : SCOPE.SINGLETON,
        inject: deps as any,
      }) {};
      // Give a meaningful name
      Object.defineProperty(cls, 'name', { value: `Svc${i}`, configurable: true });
      services.push(cls);
    }
    // services[0] = Svc10 (no deps), services[9] = Svc1 (depends on Svc2)
    // Svc1 depends on Svc2, Svc2 depends on Svc3, ..., Svc10 has no deps

    class AppModule extends Module({
      providers: services.toReversed() as any, // Svc1 first, Svc10 last
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    // Svc10 must be first (no deps), Svc1 must be last
    expect(names[0]).toBe('Svc10');
    expect(names.at(-1)).toBe('Svc1');
    expect(names).toHaveLength(10);

    // Verify ordering: each svc must appear after its dependency
    for (let i = 1; i <= 9; i++) {
      const svcIdx = names.indexOf(`Svc${i}`);
      const nextIdx = names.indexOf(`Svc${i + 1}`);
      expect(svcIdx).toBeGreaterThan(nextIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Deep module nesting
// ---------------------------------------------------------------------------
describe('buildGraph — deep module nesting', () => {
  it('detects circular module imports with visited set', () => {
    class SharedService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class ModuleA extends Module({
      providers: [SharedService],
      exports: [SharedService],
    }) {}

    const ModuleB = class extends Module({
      providers: [],
      imports: [ModuleA],
    }) {};

    (ModuleA as any)._imports = [ModuleB];

    expect(() => buildGraph(ModuleA as any)).toThrowDIError(
      DI_ERROR_CODE.CIRCULAR_DEPENDENCY,
      /Circular module import/,
    );
  });
});

// ---------------------------------------------------------------------------
// 10. Bug fix regressions: diamond module imports
// ---------------------------------------------------------------------------
describe('buildGraph — diamond module imports', () => {
  it('B3: root-level diamond does not throw DUPLICATE_PROVIDER', () => {
    class DbService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class DatabaseModule extends Module({
      providers: [DbService],
      exports: [DbService],
    }) {}

    class UserModule extends Module({
      providers: [],
      exports: [],
      imports: [DatabaseModule],
    }) {}

    class OrderModule extends Module({
      providers: [],
      exports: [],
      imports: [DatabaseModule],
    }) {}

    class AppModule extends Module({
      providers: [],
      imports: [UserModule, OrderModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toHaveLength(1);
    expect(names).toContain('DbService');
  });

  it('B2: non-root diamond does not throw CIRCULAR_DEPENDENCY', () => {
    class DbService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class DatabaseModule extends Module({
      providers: [DbService],
      exports: [DbService],
    }) {}

    class UserModule extends Module({
      providers: [],
      exports: [],
      imports: [DatabaseModule],
    }) {}

    class OrderModule extends Module({
      providers: [],
      exports: [],
      imports: [DatabaseModule],
    }) {}

    class FeatureModule extends Module({
      providers: [],
      exports: [],
      imports: [UserModule, OrderModule],
    }) {}

    class AppModule extends Module({
      providers: [],
      imports: [FeatureModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toHaveLength(1);
    expect(names).toContain('DbService');
  });

  it('diamond with providers using shared dep resolves correctly', () => {
    class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class DbService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['configService', ConfigService]],
    }) {}

    class DatabaseModule extends Module({
      providers: [ConfigService, DbService],
      exports: [DbService, ConfigService],
    }) {}

    class UserModule extends Module({
      providers: [],
      exports: [],
      imports: [DatabaseModule],
    }) {}

    class OrderModule extends Module({
      providers: [],
      exports: [],
      imports: [DatabaseModule],
    }) {}

    class AppModule extends Module({
      providers: [],
      imports: [UserModule, OrderModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toEqual(['ConfigService', 'DbService']);
  });

  it('D7: exported provider can depend on module private provider', () => {
    class PrivateService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class PublicService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['privateService', PrivateService]],
    }) {}

    class FeatureModule extends Module({
      providers: [PublicService, PrivateService],
      exports: [PublicService],
    }) {}

    class AppModule extends Module({
      providers: [],
      imports: [FeatureModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toContain('PrivateService');
    expect(names).toContain('PublicService');
    const privateIdx = names.indexOf('PrivateService');
    const publicIdx = names.indexOf('PublicService');
    expect(privateIdx).toBeLessThan(publicIdx);
  });

  it('D7: transitive private deps are collected', () => {
    class SecretService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class PrivateService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['secretService', SecretService]],
    }) {}
    class PublicService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['privateService', PrivateService]],
    }) {}

    class FeatureModule extends Module({
      providers: [PublicService, PrivateService, SecretService],
      exports: [PublicService],
    }) {}

    class AppModule extends Module({
      providers: [],
      imports: [FeatureModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toEqual(['SecretService', 'PrivateService', 'PublicService']);
  });
});

// ---------------------------------------------------------------------------
// 11. Module re-exports (exports: [SomeModule])
// ---------------------------------------------------------------------------
describe('buildGraph — module re-exports', () => {
  it('re-exported module exports are available to importing module', () => {
    class DeepService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class MidService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class TopService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [
        ['deepService', DeepService],
        ['midService', MidService],
      ],
    }) {}

    class DeepModule extends Module({
      providers: [DeepService],
      exports: [DeepService],
    }) {}

    class MidModule extends Module({
      providers: [MidService],
      imports: [DeepModule],
      exports: [DeepModule, MidService],
    }) {}

    class AppModule extends Module({
      providers: [TopService],
      imports: [MidModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toEqual(['DeepService', 'MidService', 'TopService']);
  });

  it('selective re-export: only re-exported module flows up via _exports', () => {
    class ServiceA extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class ConsumerService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {}

    class ModuleA extends Module({
      providers: [ServiceA],
      exports: [ServiceA],
    }) {}

    class ModuleB extends Module({
      providers: [ServiceB],
      exports: [ServiceB],
    }) {}

    class MidModule extends Module({
      providers: [ConsumerService],
      imports: [ModuleA, ModuleB],
      exports: [ModuleA, ConsumerService],
    }) {}

    expect(MidModule._exports).toEqual([ModuleA, ConsumerService]);
    expect(MidModule._providers).toEqual([ConsumerService]);
    expect(MidModule._combinedProviders).toEqual([ConsumerService, ServiceA, ServiceB]);
  });

  it('private deps of re-exported providers are included', () => {
    class PrivateHelper extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class PublicService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['helper', PrivateHelper]],
    }) {}
    class ConsumerService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['publicService', PublicService]],
    }) {}

    class FeatureModule extends Module({
      providers: [PublicService, PrivateHelper],
      exports: [PublicService],
    }) {}

    class FacadeModule extends Module({
      providers: [ConsumerService],
      imports: [FeatureModule],
      exports: [FeatureModule, ConsumerService],
    }) {}

    class AppModule extends Module({
      providers: [],
      imports: [FacadeModule],
    }) {}

    const result = buildGraph(AppModule);
    const names = result.sorted.map((s) => s.name);

    expect(names).toEqual(['PrivateHelper', 'PublicService', 'ConsumerService']);
  });
});
