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

const flattenExports = (exports: readonly (InjectableClass | ModuleClass)[]): InjectableClass[] => {
  const result: InjectableClass[] = [];
  for (const entry of exports) {
    if ('_isModule' in entry && entry._isModule === true) {
      result.push(...flattenExports(entry._exports));
    } else {
      result.push(entry as InjectableClass);
    }
  }
  return result;
};

const isHonoServiceInImportedExports = (imports: readonly ModuleClass[]): boolean => {
  for (const imp of imports) {
    if (flattenExports(imp._exports).includes(HonoService)) return true;
  }
  return false;
};

export const HonoModule = <
  const TProviders extends readonly InjectableClass[] = readonly [],
  const TImports extends readonly ModuleClass[] = readonly [],
  const TExports extends readonly HonoExportEntry<TProviders, TImports>[] =
    readonly HonoExportEntry<TProviders, TImports>[],
>(
  config?: HonoModuleConfig<TProviders, TImports, TExports>,
) => {
  const ensureIncluded = <T>(list: readonly T[] | undefined, item: T): readonly T[] =>
    list?.includes(item as T) ? list : [...(list ?? []), item];

  const imports = [...(config?.imports ?? [])] as TImports;
  const honoServiceAlreadyExported = isHonoServiceInImportedExports(imports);

  const providers = honoServiceAlreadyExported
    ? (config?.providers ?? [])
    : ensureIncluded(config?.providers, HonoService);

  const exports = ensureIncluded(
    config?.exports as readonly (InjectableClass | ModuleClass)[] | undefined,
    HonoService,
  );

  const Base = Module({
    providers,
    exports,
    imports,
  });

  return class extends Base {
    public static readonly _isHonoModule = true as const;
    public static readonly _honoOptions = config?.options ?? (() => ({}));
  };
};
