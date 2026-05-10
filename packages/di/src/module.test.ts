import { describe, expect, it } from "vite-plus/test";
import { DI_ERROR_CODE } from "./di-error.ts";
import { Injectable } from "./injectable.ts";
import { Module } from "./module.ts";
import { resolveExports } from "./module.ts";
import { SCOPE } from "./scope.ts";
import "./test-utils.ts";
import type { InjectableClass, ModuleClass } from "./types.ts";

class ServiceA extends Injectable({ scope: SCOPE.SINGLETON }) {
  public greet() {
    return "hello";
  }
}

class ServiceB extends Injectable({ scope: SCOPE.TRANSIENT }) {
  public compute() {
    return 42;
  }
}

class ServiceC extends Injectable({ scope: SCOPE.REQUEST }) {}

describe("Module", () => {
  it("creates a module with providers and exports", () => {
    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
      exports: [ServiceA],
    }) {}

    expect(AppModule._providers).toEqual([ServiceA, ServiceB]);
    expect(AppModule._exports).toEqual([ServiceA]);
  });

  it("defaults exports to empty array when omitted", () => {
    class PrivateModule extends Module({
      providers: [ServiceA],
    }) {}

    expect(PrivateModule._exports).toEqual([]);
  });

  it("defaults imports to empty array when omitted", () => {
    class NoImports extends Module({
      providers: [ServiceA],
    }) {}

    expect(NoImports._imports).toEqual([]);
  });

  it("accepts imports from other modules", () => {
    class SharedModule extends Module({
      providers: [ServiceA],
      exports: [ServiceA],
    }) {}

    class AppModule extends Module({
      providers: [ServiceB],
      exports: [ServiceB],
      imports: [SharedModule],
    }) {}

    expect(AppModule._imports).toEqual([SharedModule]);
    expect(AppModule._providers).toEqual([ServiceA, ServiceB]);
  });

  it("creates an empty module with no providers", () => {
    class EmptyModule extends Module({
      providers: [],
    }) {}

    expect(EmptyModule._providers).toEqual([]);
    expect(EmptyModule._exports).toEqual([]);
    expect(EmptyModule._imports).toEqual([]);
  });

  it("creates an empty module when called with no arguments", () => {
    class NoArgsModule extends Module() {}

    expect(NoArgsModule._providers).toEqual([]);
    expect(NoArgsModule._exports).toEqual([]);
    expect(NoArgsModule._imports).toEqual([]);
  });

  it("module metadata is accessible on extending class", () => {
    class AppModule extends Module({
      providers: [ServiceA, ServiceB, ServiceC],
      exports: [ServiceA, ServiceB],
    }) {}

    const providers: readonly InjectableClass[] = AppModule._providers;
    const exports: readonly (InjectableClass | ModuleClass)[] = AppModule._exports;

    expect(providers).toHaveLength(3);
    expect(exports).toHaveLength(2);
    expect(providers[0]).toBe(ServiceA);
    expect(exports[1]).toBe(ServiceB);
  });

  it("can be instantiated with new", () => {
    class AppModule extends Module({
      providers: [ServiceA],
    }) {}

    const instance = new AppModule();
    expect(instance).toBeInstanceOf(AppModule);
  });

  it("child class inherits module metadata", () => {
    class BaseModule extends Module({
      providers: [ServiceA],
      exports: [ServiceA],
    }) {}

    class ChildModule extends BaseModule {}

    expect(ChildModule._providers).toEqual([ServiceA]);
    expect(ChildModule._exports).toEqual([ServiceA]);
  });

  it("satisfies ModuleClass type", () => {
    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
      exports: [ServiceA],
    }) {}

    const mod: ModuleClass = AppModule;
    expect(mod._providers).toHaveLength(2);
    expect(mod._exports).toHaveLength(1);
  });

  it("multiple modules are independent", () => {
    class ModuleA extends Module({
      providers: [ServiceA],
      exports: [ServiceA],
    }) {}

    class ModuleB extends Module({
      providers: [ServiceB],
      exports: [ServiceB],
    }) {}

    expect(ModuleA._providers).not.toBe(ModuleB._providers);
    expect(ModuleA._exports).not.toBe(ModuleB._exports);
    expect(ModuleA._providers).toEqual([ServiceA]);
    expect(ModuleB._providers).toEqual([ServiceB]);
  });

  it("freezes _providers, _exports, and _imports at runtime", () => {
    class FrozenModule extends Module({
      providers: [ServiceA],
      exports: [ServiceA],
    }) {}

    expect(() => (FrozenModule._providers as InjectableClass[]).push(ServiceB)).toThrow(TypeError);
    expect(() => (FrozenModule._exports as InjectableClass[]).push(ServiceB)).toThrow(TypeError);
    expect(() => (FrozenModule._imports as ModuleClass[]).push(FrozenModule)).toThrow(TypeError);
  });

  it("throws EXPORT_NOT_IN_PROVIDERS when export is not in providers", () => {
    class ServiceX extends Injectable({ scope: SCOPE.SINGLETON }) {}

    expect(() => {
      class BadModule extends Module({
        providers: [ServiceA],
        exports: [ServiceX],
      }) {}
    }).toThrowDIError(DI_ERROR_CODE.EXPORT_NOT_IN_PROVIDERS, /Export ServiceX is not in providers/);
  });

  it("throws DUPLICATE_PROVIDER when same class appears twice in providers", () => {
    class SharedService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    expect(() => {
      class BadModule extends Module({
        providers: [SharedService, SharedService],
      }) {}
    }).toThrowDIError(DI_ERROR_CODE.DUPLICATE_PROVIDER, /SharedService/);
  });

  it("resolves _providers to include imported module exports", () => {
    class DeepService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class DeepModule extends Module({
      providers: [DeepService],
      exports: [DeepService],
    }) {}

    class MidModule extends Module({
      providers: [ServiceA],
      exports: [ServiceA],
      imports: [DeepModule],
    }) {}

    expect(MidModule._providers).toEqual([DeepService, ServiceA]);
  });

  it("preserves ModuleClass entries in _exports instead of flattening", () => {
    class DeepService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class DeepModule extends Module({
      providers: [DeepService],
      exports: [DeepService],
    }) {}

    class MidModule extends Module({
      providers: [ServiceA],
      imports: [DeepModule],
      exports: [DeepModule, ServiceA],
    }) {}

    expect(MidModule._exports).toEqual([DeepModule, ServiceA]);
  });

  it("preserves mixed ModuleClass and InjectableClass in _exports", () => {
    class ServiceX extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class ServiceY extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class SubModule extends Module({
      providers: [ServiceX],
      exports: [ServiceX],
    }) {}

    class ParentModule extends Module({
      providers: [ServiceY],
      imports: [SubModule],
      exports: [SubModule, ServiceY],
    }) {}

    expect(ParentModule._exports).toEqual([SubModule, ServiceY]);
  });

  it("throws DUPLICATE_PROVIDER when two imported modules export the same provider", () => {
    class SharedService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class ModuleA extends Module({
      providers: [SharedService],
      exports: [SharedService],
    }) {}

    class ModuleB extends Module({
      providers: [SharedService],
      exports: [SharedService],
    }) {}

    expect(() => {
      class AppModule extends Module({
        providers: [],
        imports: [ModuleA, ModuleB],
      }) {}
    }).toThrowDIError(DI_ERROR_CODE.DUPLICATE_PROVIDER, /SharedService/);
  });

  it("throws EXPORT_NOT_IN_PROVIDERS when re-exported module is not imported", () => {
    class OrphanService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class OrphanModule extends Module({
      providers: [OrphanService],
      exports: [OrphanService],
    }) {}

    expect(() => {
      class BadModule extends Module({
        providers: [ServiceA],
        exports: [OrphanModule],
      }) {}
    }).toThrowDIError(DI_ERROR_CODE.EXPORT_NOT_IN_PROVIDERS, /OrphanService is not in providers/);
  });
});

describe("resolveExports", () => {
  it("returns empty array for empty input", () => {
    expect(resolveExports([])).toEqual([]);
  });

  it("flattens injectable classes", () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    expect(resolveExports([MyService])).toEqual([MyService]);
  });

  it("recursively flattens module re-exports", () => {
    class DeepService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class DeepModule extends Module({
      providers: [DeepService],
      exports: [DeepService],
    }) {}

    class MidModule extends Module({
      providers: [ServiceA],
      imports: [DeepModule],
      exports: [DeepModule, ServiceA],
    }) {}

    expect(resolveExports(MidModule._exports)).toEqual([DeepService, ServiceA]);
  });

  it("flattens 3+ levels of nested module re-exports", () => {
    class LeafService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class LeafModule extends Module({
      providers: [LeafService],
      exports: [LeafService],
    }) {}

    class MidModule extends Module({
      providers: [ServiceA],
      imports: [LeafModule],
      exports: [LeafModule],
    }) {}

    class TopModule extends Module({
      providers: [ServiceB],
      imports: [MidModule],
      exports: [MidModule],
    }) {}

    expect(resolveExports(TopModule._exports)).toEqual([LeafService]);
    expect(TopModule._providers).toEqual([LeafService, ServiceB]);
  });
});
