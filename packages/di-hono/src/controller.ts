import { Injectable, SCOPE, type InjectEntry } from "@ultranomic/di";
import type { ControllerConfig, HttpMethod, RouteDefinition, ValidateTargets } from "./types.ts";

export const Controller = <
  const P extends string,
  const TInject extends readonly InjectEntry[] = readonly [],
>(
  config: ControllerConfig<P, TInject>,
) => {
  const Base = Injectable<typeof SCOPE.SINGLETON, TInject>({
    scope: SCOPE.SINGLETON,
    inject: config.inject,
  });

  return class extends Base {
    public static readonly _path: P = config.path;

    public route<T extends ValidateTargets, M extends HttpMethod, R extends string>(
      def: Omit<RouteDefinition<T, M, R>, "_isRoute">,
    ): RouteDefinition<T, M, R> {
      return {
        ...def,
        _isRoute: true as const,
      } as RouteDefinition<T, M, R>;
    }
  };
};
