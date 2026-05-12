import type { InjectableClass, InjectEntry, ModuleClass, ValidInjectEntries } from '@ultranomic/di';
import type { StandardHandlerPlugin } from '@orpc/server/standard';
import type { ORPCError, Procedure } from '@orpc/server';

export type OrpcRouterClass<TPath extends string = string> = InjectableClass & {
  readonly _isOrpcRouter: true;
  readonly _orpcPath: TPath;
};

export type OrpcMiddlewareClass = InjectableClass & {
  readonly _isOrpcMiddleware: true;
};

export type OrpcModuleClass = ModuleClass & {
  readonly _isOrpcModule: true;
  readonly _orpcOptions: OrpcModuleOptionsFactory;
};

export type OrpcModuleOptions = {
  readonly prefix?: string;
  readonly plugins?: readonly StandardHandlerPlugin<Record<PropertyKey, unknown>>[];
  readonly errorInterceptor?: ErrorInterceptor;
};

export type OrpcModuleOptionsFactory = (
  resolve: <T>(cls: InjectableClass<T>) => T,
) => OrpcModuleOptions;

export type ErrorInterceptor = (
  error: unknown,
  context: unknown,
) => ORPCError<string, unknown> | Promise<ORPCError<string, unknown>>;

export type OrpcRouterConfig<
  TPath extends string = string,
  TInject extends readonly InjectEntry[] = readonly InjectEntry[],
> = {
  readonly path: TPath;
  readonly inject?: ValidInjectEntries<TInject>;
};

export type OrpcMiddlewareConfig<TInject extends readonly InjectEntry[] = readonly InjectEntry[]> =
  {
    readonly inject?: ValidInjectEntries<TInject>;
  };

export type OrpcModuleConfig = {
  readonly prefix?: string;
  readonly plugins?: readonly StandardHandlerPlugin<Record<PropertyKey, unknown>>[];
  readonly errorInterceptor?: ErrorInterceptor;
  readonly options?: OrpcModuleOptionsFactory;
};

type ProcedureProperties<T> = {
  [K in keyof T as T[K] extends Procedure<any, any, any, any, any, any> ? K : never]: T[K];
};

type FilterRouters<T extends readonly unknown[]> = T extends readonly [infer First, ...infer Rest]
  ? First extends OrpcRouterClass
    ? readonly [First, ...FilterRouters<Rest>]
    : FilterRouters<Rest>
  : readonly [];

type BuildRouterTree<T extends readonly OrpcRouterClass[]> = T extends readonly [
  infer First extends OrpcRouterClass,
  ...infer Rest extends OrpcRouterClass[],
]
  ? (First['_orpcPath'] extends string
      ? { readonly [K in First['_orpcPath']]: ProcedureProperties<InstanceType<First>> }
      : {}) &
      BuildRouterTree<Rest>
  : {};

/**
 * Infer the ORPC router tree type from a Module class.
 *
 * Walks all resolved providers (including from imported modules),
 * filters for OrpcRouterClass entries, and builds a typed router tree
 * keyed by each router's `_orpcPath`.
 *
 * @example
 * ```ts
 * class UserModule extends Module({ providers: [UserRouter], exports: [UserRouter] }) {}
 * class AppModule extends Module({ imports: [OrpcModule(), UserModule] }) {}
 *
 * type AppRouter = InferOrpcRouterTree<typeof AppModule>
 * // => { readonly users: { readonly list: Procedure<...>; ... } }
 *
 * import type { RouterClient } from '@orpc/client'
 * type Client = RouterClient<AppRouter>
 * ```
 */
export type InferOrpcRouterTree<TModule extends ModuleClass> = BuildRouterTree<
  FilterRouters<TModule['_providers']>
>;
