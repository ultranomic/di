import { type InjectableClass, type ModuleClass, Module } from '@ultranomic/di';
import { HonoService } from './hono-service.ts';
import type { HonoModuleOptionsFactory } from './types.ts';

export const HonoModule = <
  const TProviders extends readonly InjectableClass[] = readonly [],
  const TImports extends readonly ModuleClass[] = readonly [],
  const TExports extends readonly (TProviders[number] | TImports[number])[] = readonly [],
>(config: {
  providers?: TProviders;
  exports?: TExports;
  imports?: TImports;
  options: HonoModuleOptionsFactory;
}) => {
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
    public static readonly _honoOptions = config.options;
  };
};
