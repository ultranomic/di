import type { InjectableClass, InjectEntry, ModuleClass } from '@ultranomic/di';
import type { Context, MiddlewareHandler } from 'hono';
import type {
  ServerOptions as Http2ServerOptions,
  SecureServerOptions as Http2SecureServerOptions,
} from 'node:http2';
import type { ServerOptions as HttpsServerOptions } from 'node:https';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type StandardPathSegment = {
  readonly key: PropertyKey;
};

export type StandardIssue = {
  readonly message: string;
  readonly path?: readonly (PropertyKey | StandardPathSegment)[];
};

export type StandardResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly issues: readonly StandardIssue[] };

export type StandardSchema<Input = unknown, Output = Input> = {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
      options?: { readonly libraryOptions?: Record<string, unknown> },
    ) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output };
  };
};

export const VALIDATE_TARGETS = ['json', 'query', 'param', 'header', 'form', 'cookie'] as const;

export type ValidateTargets = Readonly<
  Partial<Record<(typeof VALIDATE_TARGETS)[number], StandardSchema>>
>;

type SchemaOutput<S> = S extends StandardSchema<any, infer O> ? O : unknown;

type ValidatedRouteInput<T extends ValidateTargets> = {
  out: {
    [K in keyof T as T[K] extends StandardSchema<any, any> ? K : never]: SchemaOutput<
      NonNullable<T[K]>
    >;
  };
};

export type RouteDefinition<
  T extends ValidateTargets = ValidateTargets,
  M extends HttpMethod = HttpMethod,
  P extends string = string,
  R = Response | Promise<Response>,
> = {
  readonly _isRoute: true;
  readonly method: M;
  readonly path: P;
  readonly validate?: T;
  readonly handler: (c: Context<any, P, ValidatedRouteInput<T>>) => R;
};

export type ControllerConfig<
  P extends string = string,
  TInject extends readonly InjectEntry[] = readonly InjectEntry[],
> = {
  readonly path: P;
  readonly inject?: TInject;
};

export type ControllerClass<P extends string = string> = InjectableClass & {
  readonly _path: P;
};

export type HonoModuleClass = ModuleClass & {
  readonly _isHonoModule: true;
  readonly _honoOptions: HonoModuleOptionsFactory;
};

export type Http2Options = {
  readonly createServer: typeof import('node:http2').createServer;
  readonly serverOptions?: Http2ServerOptions;
};

export type Http2SecureOptions = {
  readonly createServer: typeof import('node:http2').createSecureServer;
  readonly serverOptions?: Http2SecureServerOptions;
};

export type HttpsOptions = {
  readonly createServer: typeof import('node:https').createServer;
  readonly serverOptions?: HttpsServerOptions;
};

export type HonoModuleOptions = {
  readonly middlewares?: readonly MiddlewareHandler[];
  readonly port: number;
  readonly host: string;
  readonly server?: Http2Options | Http2SecureOptions | HttpsOptions;
};

export type HonoModuleOptionsFactory = (
  resolve: <T>(cls: InjectableClass<T>) => T,
) => HonoModuleOptions;

export type RequestContextClass = InjectableClass & {
  readonly _isRequestContext: true;
  readonly _createContext: (c: Context) => unknown;
  run<R>(c: Context, fn: () => Promise<R>): Promise<R>;
};
