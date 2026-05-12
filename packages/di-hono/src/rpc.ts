import type { Hono } from 'hono';
import type { MergePath, Schema, ToSchema, TypedResponse } from 'hono/types';
import type { ModuleClass } from '@ultranomic/di';
import type { ControllerClass, RouteDefinition, StandardSchema, ValidateTargets } from './types.ts';

// --- Utility types ---

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

// Replicate Hono's internal MergeTypedResponse (not exported from hono/types)
type MergeTypedResponse<T> =
  T extends Promise<void>
    ? T
    : T extends Promise<infer T2>
      ? T2 extends TypedResponse
        ? T2
        : TypedResponse
      : T extends TypedResponse
        ? T
        : TypedResponse;

// --- Input extraction ---

type SchemaOutput<S> = S extends StandardSchema<any, infer O> ? O : unknown;

type ValidatedOutput<T extends ValidateTargets> = {
  [K in keyof T as T[K] extends StandardSchema<any, any> ? K : never]: SchemaOutput<
    NonNullable<T[K]>
  >;
};

type RouteInput<T extends ValidateTargets> = { in: ValidatedOutput<T> };

// --- Controller route extraction ---

type ExtractRouteDefs<T> = Exclude<
  {
    [K in keyof T]: T[K] extends RouteDefinition<any, any, any, any> ? T[K] : never;
  }[keyof T],
  never
>;

// Build schema for all routes in a single controller
type ControllerRoutesToSchema<RDefs, CPath extends string> =
  RDefs extends RouteDefinition<infer T, infer M, infer P, infer R>
    ? ToSchema<
        Lowercase<M & string>,
        MergePath<CPath, P>,
        RouteInput<T extends ValidateTargets ? T : ValidateTargets>,
        MergeTypedResponse<R>
      >
    : never;

// Build schema for all routes in a controller
type ControllerToSchema<C extends ControllerClass<string>> = UnionToIntersection<
  ControllerRoutesToSchema<ExtractRouteDefs<InstanceType<C>>, C['_path']>
>;

// Build schema for all controllers in a provider list
type ProvidersToSchema<Providers extends readonly any[]> = UnionToIntersection<
  Providers[number] extends infer C
    ? C extends ControllerClass<string>
      ? ControllerToSchema<C>
      : never
    : never
>;

// --- Main type ---

type ComputedSchema<M extends ModuleClass> = ProvidersToSchema<M['_combinedProviders']>;

export type HonoRpcType<M extends ModuleClass> =
  ComputedSchema<M> extends Schema ? Hono<{}, ComputedSchema<M>, '/'> : Hono<{}, Schema, '/'>;
