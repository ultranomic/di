import type { InjectableClass, InjectEntry, ModuleClass } from '@ultranomic/di';
import type { Context, MiddlewareHandler } from 'hono';

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
> = {
  readonly _isRoute: true;
  readonly method: M;
  readonly path: P;
  readonly validate?: T;
  readonly handler: (c: Context<any, P, ValidatedRouteInput<T>>) => Promise<Response> | Response;
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

export type HonoModuleOptions = {
  readonly middlewares?: readonly MiddlewareHandler[];
  readonly port?: number;
  readonly host?: string;
};

export type HonoModuleOptionsFactory = (
  resolve: <T>(cls: InjectableClass<T>) => T,
) => HonoModuleOptions;
