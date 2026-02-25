// ============================================================================
// Constructor Parameter Injection Pattern Types
// ============================================================================

import type { Injectable } from './injectable.ts';

/**
 * Validates that an inject array matches the constructor parameters.
 *
 * Each element in the inject array must be an Injectable class constructor
 * that is assignable to the corresponding constructor parameter.
 *
 * @example
 * class MyClass extends Injectable {
 *   static readonly inject = [Foo, Bar] as const satisfies DependencyTokens<typeof this>;
 *   constructor(public foo: Foo, public bar: Bar) {}
 * }
 */
// oxlint-disable-next-line typescript-eslint/no-explicit-any
export type DependencyTokens<T extends abstract new (...args: any) => any> = T extends abstract new (
  ...args: infer P
) => any
  ? P extends Array<any> // oxlint-disable-line typescript-eslint/no-explicit-any
    ? { [K in keyof P]: abstract new (...args: any[]) => P[K] & Injectable } // oxlint-disable-line typescript-eslint/no-explicit-any)
    : never
  : never;

/**
 * Extracts resolved types from an inject array of class tokens.
 *
 * Takes an inject tuple and resolves each token to its instance type.
 * Classes resolve to their instance type.
 *
 * @example
 * const inject = [Foo, Bar] as const;
 * type Injected = InferInjectedInstanceTypes<typeof inject>; // [Foo, Bar]
 */
// oxlint-disable-next-line typescript-eslint/no-explicit-any
export type InferInjectedInstanceTypes<T extends readonly [...any[]]> = {
  [K in keyof T]: T[K] extends abstract new (...args: any[]) => infer R // oxlint-disable-line typescript-eslint/no-explicit-any)
    ? R
    : never;
};

/**
 * InjectableClass represents a class using the array-based inject pattern.
 *
 * @template TInject - The type of the inject array (readonly tuple of tokens)
 * @template TInstance - The type of instance the class creates
 */
// oxlint-disable-next-line typescript-eslint/no-explicit-any
export type InjectableClass<TInject extends readonly [...any[]] = readonly [...any[]], TInstance = unknown> = (new (
  ...args: InferInjectedInstanceTypes<TInject>
) => TInstance) & {
  inject: TInject;
};

/**
 * Helper type to extract the inject array from a class
 */
export type ExtractInjectArray<T> = T extends { inject: infer I } ? I : never;
