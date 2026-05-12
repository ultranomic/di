import {
  Injectable,
  SCOPE,
  type InjectableClass,
  type InjectEntry,
  type ToInjectObject,
} from '@ultranomic/di';
import { os, type Context } from '@orpc/server';
import type { OrpcRouterConfig } from './types.ts';

type OrpcRouterInstance<TInject extends readonly InjectEntry[]> = {
  readonly inject: ToInjectObject<TInject>;
  readonly orpc: ReturnType<typeof os.$context<Context>>;
};

type OrpcRouterBase<TPath extends string, TInject extends readonly InjectEntry[]> = InjectableClass<
  OrpcRouterInstance<TInject>,
  TInject,
  typeof SCOPE.SINGLETON
> & {
  readonly _isOrpcRouter: true;
  readonly _orpcPath: TPath;
};

export const OrpcRouter = <
  TContext extends Context = Context,
  const TPath extends string = string,
  const TInject extends readonly InjectEntry[] = readonly [],
>(
  config: OrpcRouterConfig<TPath, TInject>,
): OrpcRouterBase<TPath, TInject> => {
  const Base = Injectable<typeof SCOPE.SINGLETON, TInject>({
    scope: SCOPE.SINGLETON,
    inject: config.inject,
  });

  return class extends Base {
    public static readonly _isOrpcRouter = true as const;
    public static readonly _orpcPath: TPath = config.path;

    protected get orpc() {
      return os.$context<TContext>();
    }
  } as unknown as OrpcRouterBase<TPath, TInject>;
};
