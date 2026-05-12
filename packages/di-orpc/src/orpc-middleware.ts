import {
  Injectable,
  SCOPE,
  type InjectableClass,
  type InjectEntry,
  type ToInjectObject,
} from '@ultranomic/di';
import { os, type Context } from '@orpc/server';
import type { OrpcMiddlewareConfig } from './types.ts';

type OrpcMiddlewareInstance<TInject extends readonly InjectEntry[]> = {
  readonly inject: ToInjectObject<TInject>;
  readonly orpc: ReturnType<typeof os.$context<Context>>;
};

type OrpcMiddlewareBase<TInject extends readonly InjectEntry[]> = InjectableClass<
  OrpcMiddlewareInstance<TInject>,
  TInject,
  typeof SCOPE.SINGLETON
> & {
  readonly _isOrpcMiddleware: true;
};

export const OrpcMiddleware = <
  TContext extends Context = Context,
  const TInject extends readonly InjectEntry[] = readonly [],
>(
  config: OrpcMiddlewareConfig<TInject> = {},
): OrpcMiddlewareBase<TInject> => {
  const Base = Injectable<typeof SCOPE.SINGLETON, TInject>({
    scope: SCOPE.SINGLETON,
    inject: config.inject,
  });

  return class extends Base {
    public static readonly _isOrpcMiddleware = true as const;

    protected get orpc() {
      return os.$context<TContext>();
    }
  } as unknown as OrpcMiddlewareBase<TInject>;
};
