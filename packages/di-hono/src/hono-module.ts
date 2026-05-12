import { type Constructor, type InjectableClass, type ModuleClass, Module } from '@ultranomic/di';
import { HonoService } from './hono-service.ts';
import type { HonoModuleOptionsFactory } from './types.ts';

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

export type HonoModuleConfig<
  TProviders extends readonly InjectableClass[] = readonly InjectableClass[],
  TImports extends readonly ModuleClass[] = readonly ModuleClass[],
  TExports extends readonly (TProviders[number] | TImports[number])[] = readonly (
    | TProviders[number]
    | TImports[number]
  )[],
> = {
  readonly providers?: TProviders;
  readonly exports?: TExports;
  readonly imports?: TImports;
  readonly options: HonoModuleOptionsFactory;
};

type HonoModuleBase<
  TProviders extends readonly InjectableClass[],
  TImports extends readonly ModuleClass[],
  TExports extends readonly (InjectableClass | ModuleClass)[],
> = Constructor<object> & {
  readonly _isModule: true;
  readonly _isHonoModule: true;
  readonly _honoOptions: HonoModuleOptionsFactory;
  readonly _providers: TProviders;
  readonly _exports: TExports;
  readonly _imports: TImports;
  readonly _combinedProviders: readonly [...TProviders, ...FlattenExports<TImports>];
  readonly _combinedExports: FlattenExports<TExports>;
};

export const HonoModule = <
  const TProviders extends readonly InjectableClass[] = readonly [],
  const TImports extends readonly ModuleClass[] = readonly [],
  const TExports extends readonly (TProviders[number] | TImports[number])[] = readonly [],
>(
  config: HonoModuleConfig<TProviders, TImports, TExports>,
): HonoModuleBase<
  [...TProviders, typeof HonoService],
  TImports,
  [...TExports, typeof HonoService]
> => {
  const providers = [...(config?.providers ?? []), HonoService] as [
    ...TProviders,
    typeof HonoService,
  ];
  const exports = [...(config?.exports ?? []), HonoService] as [...TExports, typeof HonoService];

  return class extends Module<
    [...TProviders, typeof HonoService],
    TImports,
    // @ts-ignore
    [...TExports, typeof HonoService]
  >({
    providers,
    exports,
    imports: config?.imports,
  }) {
    public static readonly _isHonoModule = true as const;
    public static readonly _honoOptions: HonoModuleOptionsFactory = config.options;
  } satisfies HonoModuleBase<
    [...TProviders, typeof HonoService],
    TImports,
    [...TExports, typeof HonoService]
  > as HonoModuleBase<
    [...TProviders, typeof HonoService],
    TImports,
    [...TExports, typeof HonoService]
  >;
};
