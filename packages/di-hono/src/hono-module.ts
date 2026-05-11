import { type InjectableClass, type ModuleClass, Module } from '@ultranomic/di';
import { HonoService } from './hono-service.ts';
import type { HonoModuleOptionsFactory } from './types.ts';

type HonoExportEntry<
  TProviders extends readonly InjectableClass[],
  TImports extends readonly ModuleClass[],
> = TProviders[number] | TImports[number];

export type HonoModuleConfig<
  TProviders extends readonly InjectableClass[] = readonly InjectableClass[],
  TImports extends readonly ModuleClass[] = readonly ModuleClass[],
  TExports extends readonly HonoExportEntry<TProviders, TImports>[] = readonly HonoExportEntry<
    TProviders,
    TImports
  >[],
> = {
  readonly providers?: TProviders;
  readonly exports?: TExports;
  readonly imports?: TImports;
  readonly options?: HonoModuleOptionsFactory;
};

const ensureIncluded = <T>(list: readonly T[] | undefined, item: T): readonly T[] =>
  list?.includes(item as T) ? list : [...(list ?? []), item];

export const HonoModule = <
  const TProviders extends readonly InjectableClass[] = readonly [],
  const TImports extends readonly ModuleClass[] = readonly [],
  const TExports extends readonly HonoExportEntry<TProviders, TImports>[] =
    readonly HonoExportEntry<TProviders, TImports>[],
>(
  config?: HonoModuleConfig<TProviders, TImports, TExports>,
) => {
  const providers = ensureIncluded(config?.providers, HonoService);
  const exports = ensureIncluded(
    config?.exports as readonly (InjectableClass | ModuleClass)[] | undefined,
    HonoService,
  );

  const Base = Module({
    providers,
    exports,
    imports: config?.imports,
  });

  return class extends Base {
    public static readonly _isHonoModule = true as const;
    public static readonly _honoOptions = config?.options ?? (() => ({}));
  };
};
