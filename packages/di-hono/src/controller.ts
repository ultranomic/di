import {
  Injectable,
  SCOPE,
  type InjectableClass,
  type InjectEntry,
  type ToInjectObject,
} from '@ultranomic/di';
import type { ControllerConfig, HttpMethod, RouteDefinition, ValidateTargets } from './types.ts';

type ControllerInstance<TInject extends readonly InjectEntry[]> = {
  readonly inject: ToInjectObject<TInject>;
  route<T extends ValidateTargets, M extends HttpMethod, P extends string, Resp>(
    def: Omit<RouteDefinition<T, M, P, Resp>, '_isRoute'>,
  ): RouteDefinition<T, M, P, Resp>;
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
    inject: config.inject,
  });

  return class extends Base {
    public static readonly _path: P = config.path;

    public route<T extends ValidateTargets, M extends HttpMethod, P extends string, Resp>(
      def: Omit<RouteDefinition<T, M, P, Resp>, '_isRoute'>,
    ): RouteDefinition<T, M, P, Resp> {
      return {
        ...def,
        _isRoute: true as const,
      } as RouteDefinition<T, M, P, Resp>;
    }
  } satisfies ControllerBase<P, TInject> as ControllerBase<P, TInject>;
};
