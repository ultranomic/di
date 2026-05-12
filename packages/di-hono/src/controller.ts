import {
  Injectable,
  SCOPE,
  type InjectableClass,
  type InjectEntry,
  type ToInjectObject,
  type ValidInjectEntries,
} from '@ultranomic/di';
import type { ControllerConfig, HttpMethod, RouteDefinition, ValidateTargets } from './types.ts';

type ControllerInstance<TInject extends readonly InjectEntry[]> = {
  readonly inject: ToInjectObject<TInject>;
  route<T extends ValidateTargets, M extends HttpMethod, R extends string>(
    def: Omit<RouteDefinition<T, M, R>, '_isRoute'>,
  ): RouteDefinition<T, M, R>;
};

type ControllerBase<P extends string, TInject extends readonly InjectEntry[]> = InjectableClass<
  ControllerInstance<TInject>,
  TInject,
  typeof SCOPE.SINGLETON
> & {
  readonly _path: P;
};

export const Controller = <
  const P extends string,
  const TInject extends readonly InjectEntry[] = readonly [],
>(
  config: ControllerConfig<P, TInject>,
): ControllerBase<P, TInject> => {
  const Base = Injectable<typeof SCOPE.SINGLETON, TInject>({
    scope: SCOPE.SINGLETON,
    inject: config.inject as ValidInjectEntries<TInject> | undefined,
  });

  return class extends Base {
    public static readonly _path: P = config.path;

    public route<T extends ValidateTargets, M extends HttpMethod, R extends string>(
      def: Omit<RouteDefinition<T, M, R>, '_isRoute'>,
    ): RouteDefinition<T, M, R> {
      return {
        ...def,
        _isRoute: true as const,
      } as RouteDefinition<T, M, R>;
    }
  } satisfies ControllerBase<P, TInject> as ControllerBase<P, TInject>;
};
