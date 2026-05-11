import type { ValidInjectEntries } from '@ultranomic/di';
import { Injectable, SCOPE, type InjectableClass } from '@ultranomic/di';
import { os, type Context } from '@orpc/server';
import type { OrpcMiddlewareConfig } from './types.ts';

export const OrpcMiddleware = <
  TContext extends Context = Context,
  const TInject extends readonly (readonly [string, InjectableClass])[] = never[],
>(
  config: OrpcMiddlewareConfig<TInject> = {},
) => {
  const Base = Injectable<typeof SCOPE.SINGLETON, TInject>({
    scope: SCOPE.SINGLETON,
    inject: config.inject as ValidInjectEntries<TInject> | undefined,
  });

  return class extends Base {
    public static readonly _isOrpcMiddleware = true as const;

    protected get orpc() {
      return os.$context<TContext>();
    }
  };
};
