import { describe, expect, it } from 'vite-plus/test';
import { SCOPE, type Scope } from './scope.ts';
import type {
  Constructor,
  GraphResult,
  InjectableClass,
  LifecycleHooks,
  ModuleClass,
} from './types.ts';

describe('types (compile-time + Runtime checks)', () => {
  it('Constructor works as a generic factory type', () => {
    class Foo {
      public value;
      public constructor(value: number) {
        this.value = value;
      }
    }
    const Ctor: Constructor<Foo> = Foo;
    const instance = new Ctor(42);
    expect(instance).toBeInstanceOf(Foo);
    expect(instance.value).toBe(42);
  });

  it('InjectableClass shape is assignable', () => {
    class MyService {
      public static _scope: Scope = SCOPE.SINGLETON;
      public static _inject: readonly InjectableClass[] = [];
    }
    const svc: InjectableClass = MyService as unknown as InjectableClass;
    expect(svc._scope).toBe(SCOPE.SINGLETON);
    expect(svc._inject).toHaveLength(0);
  });

  it('ModuleClass shape is assignable', () => {
    class Provider {
      public static _scope: Scope = SCOPE.TRANSIENT;
      public static _inject: readonly InjectableClass[] = [];
    }
    class MyModule {
      public static _providers: readonly InjectableClass[] = [
        Provider as unknown as InjectableClass,
      ];
      public static _exports: readonly (InjectableClass | ModuleClass)[] = [
        Provider as unknown as InjectableClass,
      ];
    }
    const mod: ModuleClass = MyModule as unknown as ModuleClass;
    expect(mod._providers).toHaveLength(1);
    expect(mod._exports).toHaveLength(1);
  });

  it('LifecycleHooks both hooks can be implemented', async () => {
    const hooks: LifecycleHooks = {
      async onStart() {},
      onStop() {},
    };
    expect(typeof hooks.onStart).toBe('function');
    expect(typeof hooks.onStop).toBe('function');
    await hooks.onStart?.({});
    await hooks.onStop?.({});
  });

  it('GraphResult holds sorted injectables', () => {
    class A {
      public static _scope: Scope = SCOPE.SINGLETON;
      public static _inject: readonly InjectableClass[] = [];
    }
    const result: GraphResult = {
      sorted: [A as unknown as InjectableClass],
    };
    expect(result.sorted).toHaveLength(1);
  });
});
