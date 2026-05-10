import { DI_ERROR_CODE, DIError } from "./di-error.ts";
import type { InjectableClass, ModuleClass } from "./types.ts";

type FlattenExports<T extends readonly unknown[]> = T extends readonly [
  infer First,
  ...infer Rest extends readonly unknown[],
]
  ? First extends ModuleClass
    ? readonly [...FlattenExports<First["_exports"]>, ...FlattenExports<Rest>]
    : First extends InjectableClass
      ? readonly [First, ...FlattenExports<Rest>]
      : never
  : readonly [];

type ImportedExports<TImports extends readonly ModuleClass[]> = TImports extends readonly [
  infer First extends ModuleClass,
  ...infer Rest extends ModuleClass[],
]
  ? readonly [...FlattenExports<First["_exports"]>, ...ImportedExports<Rest>]
  : readonly [];

export type ResolvedProviders<
  TProviders extends readonly InjectableClass[],
  TImports extends readonly ModuleClass[],
> = readonly [...ImportedExports<TImports>, ...TProviders];

const isModuleClass = (entry: InjectableClass | ModuleClass): entry is ModuleClass =>
  "_isModule" in entry && entry._isModule === true;

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
  return Object.freeze(result);
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
}) => {
  const ownProviders: readonly InjectableClass[] = [...(config?.providers ?? [])];
  const rawExports: readonly (InjectableClass | ModuleClass)[] = Object.freeze([
    ...(config?.exports ?? []),
  ]);
  const imports: TImports = Object.freeze([...(config?.imports ?? [])]) as unknown as TImports;

  const importedExports = imports.flatMap((imported) => resolveExports(imported._exports));

  const resolvedProviders: InjectableClass[] = [...importedExports, ...ownProviders];
  const resolvedExports = resolveExports(rawExports);

  const seenProviders = new Set<InjectableClass>();
  for (const provider of resolvedProviders) {
    if (seenProviders.has(provider)) {
      throw new DIError(
        DI_ERROR_CODE.DUPLICATE_PROVIDER,
        `Duplicate provider: ${provider.name} is registered more than once`,
      );
    }
    seenProviders.add(provider);
  }

  for (const exp of resolvedExports) {
    if (!seenProviders.has(exp)) {
      throw new DIError(
        DI_ERROR_CODE.EXPORT_NOT_IN_PROVIDERS,
        `Export ${exp.name} is not in providers`,
      );
    }
  }

  const frozenProviders = Object.freeze(resolvedProviders) as ResolvedProviders<
    TProviders,
    TImports
  >;
  const frozenExports = rawExports as TExports;

  return class {
    public static readonly _isModule = true as const;
    /** Fully resolved providers: imported modules' flattened exports + own providers. */
    public static readonly _providers: ResolvedProviders<TProviders, TImports> = frozenProviders;
    /** Raw exports config — may contain `ModuleClass` entries that are flattened internally when resolving providers. */
    public static readonly _exports: TExports = frozenExports;
    public static readonly _imports: TImports = imports;
  };
};
