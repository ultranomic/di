import { DI_ERROR_CODE, DIError } from './di-error.ts';
import type { Constructor, InjectableClass, ModuleClass } from './types.ts';

const isModuleClass = (entry: InjectableClass | ModuleClass): entry is ModuleClass =>
  '_isModule' in entry && entry._isModule === true;

/**
 * Recursively flatten module exports into a list of injectable classes.
 * Module entries in the exports array are resolved to their own exports recursively.
 * @param {readonly (InjectableClass | ModuleClass)[]} entries - Array of injectable classes and/or module classes to resolve.
 * @returns {readonly InjectableClass[]} A frozen, readonly array of resolved injectable classes.
 */
export const resolveExports = (
  entries: readonly (InjectableClass | ModuleClass)[],
): readonly InjectableClass[] => {
  const result: InjectableClass[] = [];
  for (const entry of entries) {
    if (isModuleClass(entry)) {
      result.push(...resolveExports(entry._exports));
    } else {
      result.push(entry);
    }
  }
  return result;
};

type FlattenExports<T extends readonly unknown[]> = T extends readonly [
  infer First,
  ...infer Rest extends readonly unknown[],
]
  ? First extends ModuleClass
    ? readonly [...First['_combinedExports'], ...FlattenExports<Rest>]
    : First extends InjectableClass
      ? readonly [First, ...FlattenExports<Rest>]
      : never
  : readonly [];

type ModuleBase<
  TProviders extends readonly InjectableClass[] = readonly InjectableClass[],
  TImports extends readonly ModuleClass[] = readonly ModuleClass[],
  TExports extends readonly (InjectableClass | ModuleClass)[] = readonly (
    | InjectableClass
    | ModuleClass
  )[],
> = Constructor<object> & {
  readonly _isModule: true;
  readonly _providers: TProviders;
  readonly _exports: TExports;
  readonly _imports: TImports;
  readonly _combinedProviders: readonly [...TProviders, ...FlattenExports<TImports>];
  readonly _combinedExports: FlattenExports<TExports>;
};

/**
 * Mixin factory that groups providers and declares what's shared with other modules.
 * @param {{ providers?: TProviders; imports?: TImports; exports?: TExports }} config - Optional configuration with providers, exports, and imports.
 * @returns {ModuleClass} A base class to extend for your module definition.
 * @example
 * ```ts
 * class AppModule extends Module({
 *   providers: [LoggerService, UserService],
 *   exports: [UserService],
 * }) {}
 * ```
 */
export const Module = <
  const TProviders extends readonly InjectableClass[] = readonly [],
  const TImports extends readonly ModuleClass[] = readonly [],
  const TExports extends readonly (TProviders[number] | TImports[number])[] = readonly [],
>(config?: {
  providers?: TProviders;
  imports?: TImports;
  exports?: TExports;
}): ModuleBase<TProviders, TImports, TExports> => {
  const providers = (config?.providers ?? []) as TProviders;
  const imports = (config?.imports ?? []) as TImports;
  const exports = (config?.exports ?? []) as TExports;

  for (const exp of exports) {
    if (isModuleClass(exp)) {
      if (imports.includes(exp)) continue;
      throw new DIError(
        DI_ERROR_CODE.EXPORT_NOT_IN_IMPORTS,
        `Export ${exp.name} is not in imports`,
      );
    } else {
      if (providers.includes(exp)) continue;
      throw new DIError(
        DI_ERROR_CODE.EXPORT_NOT_IN_PROVIDERS,
        `Export ${exp.name} is not in providers`,
      );
    }
  }

  const combinedProviders = [
    ...providers,
    ...(imports.flatMap((m) => m._combinedExports) as unknown as FlattenExports<TImports>),
  ] as const;
  const combinedExports = exports.flatMap((e) =>
    isModuleClass(e) ? e._combinedExports : [e],
  ) as unknown as FlattenExports<TExports>;

  return class {
    public static readonly _isModule: true = true as const;
    public static readonly _providers: TProviders = providers;
    public static readonly _imports: TImports = imports;
    public static readonly _exports: TExports = exports;
    public static readonly _combinedProviders: readonly [
      ...TProviders,
      ...FlattenExports<TImports>,
    ] = combinedProviders as unknown as readonly [...TProviders, ...FlattenExports<TImports>];
    public static readonly _combinedExports: FlattenExports<TExports> =
      combinedExports as unknown as FlattenExports<TExports>;
  };
};
