import { type Constructor, type ModuleClass, Module } from '@ultranomic/di';
import { OrpcService } from './orpc-service.ts';
import type { OrpcModuleConfig, OrpcModuleOptionsFactory } from './types.ts';

type OrpcModuleBase = Constructor<object> & {
  readonly _isModule: true;
  readonly _isOrpcModule: true;
  readonly _orpcOptions: OrpcModuleOptionsFactory;
  readonly _providers: readonly [typeof OrpcService];
  readonly _exports: readonly [typeof OrpcService];
  readonly _imports: readonly ModuleClass[];
  readonly _combinedProviders: readonly [typeof OrpcService];
  readonly _combinedExports: readonly [typeof OrpcService];
};

export const OrpcModule = (config?: OrpcModuleConfig): OrpcModuleBase => {
  const optionsFactory: OrpcModuleOptionsFactory =
    config?.options ??
    ((_resolve) => ({
      prefix: config?.prefix ?? '/rpc',
      plugins: config?.plugins,
      errorInterceptor: config?.errorInterceptor,
    }));

  return class OrpcModule extends Module({
    providers: [OrpcService],
    exports: [OrpcService],
  }) {
    public static readonly _isOrpcModule = true as const;
    public static readonly _orpcOptions: OrpcModuleOptionsFactory = optionsFactory;
  } satisfies OrpcModuleBase as OrpcModuleBase;
};
