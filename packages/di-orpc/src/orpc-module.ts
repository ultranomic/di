import { Module } from '@ultranomic/di';
import { OrpcService } from './orpc-service.ts';
import type { OrpcModuleConfig, OrpcModuleOptionsFactory } from './types.ts';

export const OrpcModule = (config?: OrpcModuleConfig) => {
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
    public static readonly _orpcOptions = optionsFactory;
  };
};
