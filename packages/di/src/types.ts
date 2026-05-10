import type { Scope } from "./scope.ts";

/** Generic class constructor type. */
// oxlint-disable-next-line typescript/no-explicit-any
export type Constructor<T = unknown> = new (...args: any[]) => T;

/** Minimal InjectableClassBase shape used for forward declarations and internal graph traversal. */
export type InjectableClassBase = Constructor<unknown> & {
  readonly _isInjectable: true;
  readonly _scope: Scope;
  readonly _inject: readonly InjectableClassBase[];
};

/** Tuple of `[name, InjectableClassBase]` for declaring injectable dependencies. The name becomes a property on `this.inject`. */
export type InjectEntry = readonly [string, InjectableClassBase];

/** A `Constructor` with `_scope` and `_inject` static metadata attached by `Injectable()`. */
export type InjectableClass<
  T = unknown,
  TInject extends readonly InjectableClassBase[] = readonly InjectableClassBase[],
  TScope extends Scope = Scope,
> = Constructor<T> &
  Omit<InjectableClassBase, "_scope" | "_inject"> & {
    readonly _scope: TScope;
    readonly _inject: TInject;
  };

/** A `Constructor` with `_providers`, `_exports`, and `_imports` static metadata attached by `Module()`. */
export type ModuleClass = Constructor & {
  readonly _isModule: true;
  readonly _providers: readonly InjectableClass[];
  readonly _exports: readonly (InjectableClass | ModuleClass)[];
  readonly _imports: readonly ModuleClass[];
};

/** Optional lifecycle hooks that providers can implement for startup and shutdown. */
export type LifecycleHooks<T = unknown> = {
  onStart?(container: T): Promise<void> | void;
  onStop?(container: T): Promise<void> | void;
};

/** Resolved dependency graph containing a topologically sorted provider list. */
export type GraphResult = { readonly sorted: readonly InjectableClass[] };
