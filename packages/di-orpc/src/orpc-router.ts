import type { ValidInjectEntries } from '@ultranomic/di';
import { Injectable, SCOPE, type InjectableClass } from '@ultranomic/di';
import { os, type Context } from '@orpc/server';
import type { OrpcRouterConfig } from './types.ts';

export const OrpcRouter = <
  TContext extends Context = Context,
  const TPath extends string = string,
  const TInject extends readonly (readonly [string, InjectableClass])[] = never[],
>(
  config: OrpcRouterConfig<TPath, TInject>,
) => {
  const Base = Injectable<typeof SCOPE.SINGLETON, TInject>({
    scope: SCOPE.SINGLETON,
    inject: config.inject as ValidInjectEntries<TInject> | undefined,
  });

  return class extends Base {
    public static readonly _isOrpcRouter = true as const;
    public static readonly _orpcPath: TPath = config.path;

    protected get orpc() {
      return os.$context<TContext>();
    }
  };
};
