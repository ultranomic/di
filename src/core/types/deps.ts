import type { TokenRegistry } from './token.ts';

// ============================================================================
// Constructor Parameter Injection Pattern Types
// ============================================================================

/**
 * Validates that an inject array matches the constructor parameters.
 *
 * Each element in the inject array must be assignable to the corresponding
 * constructor parameter. This allows strings, symbols, or class constructors
 * as injection tokens.
 *
 * @example
 * class MyClass {
 *   static readonly inject = [Foo, Bar] as const satisfies DepsTokens<typeof MyClass>;
 *   constructor(public foo: Foo, public bar: Bar) {}
 * }
 */
// oxlint-disable-next-line typescript-eslint(no-explicit-any)
export type DepsTokens<T extends abstract new (...args: any) => any> = T extends abstract new (...args: infer P) => any
  ? P extends Array<any> // oxlint-disable-line typescript-eslint(no-explicit-any)
    ? { [K in keyof P]: (abstract new (...args: any[]) => P[K]) | string | symbol } // oxlint-disable-line typescript-eslint(no-explicit-any)
    : never
  : never;

/**
 * Extracts resolved types from an inject array.
 *
 * Takes an inject tuple and resolves each token to its actual type.
 * Classes resolve to their instance type, strings/symbols resolve to
 * types from TokenRegistry (or unknown if not registered).
 *
 * @example
 * const inject = [Foo, 'BarToken'] as const;
 * type Injected = InferInject<typeof inject>; // [Foo, unknown]
 */
// oxlint-disable-next-line typescript-eslint(no-explicit-any)
export type InferInject<T extends readonly [...any[]], TRegistry extends TokenRegistry = TokenRegistry> = {
  [K in keyof T]: T[K] extends abstract new (...args: any[]) => infer R // oxlint-disable-line typescript-eslint(no-explicit-any)
    ? R
    : T[K] extends keyof TRegistry
      ? TRegistry[T[K]]
      : unknown;
};

/**
 * InjectableClass represents a class using the array-based inject pattern.
 *
 * @template TInject - The type of the inject array (readonly tuple of tokens)
 * @template TInstance - The type of instance the class creates
 */
// oxlint-disable-next-line typescript-eslint(no-explicit-any)
export type InjectableClass<TInject extends readonly [...any[]] = readonly [...any[]], TInstance = unknown> = (new (
  ...args: InferInject<TInject>
) => TInstance) & {
  inject: TInject;
};

/**
 * Helper type to extract the inject array from a class
 */
export type ExtractInject<T> = T extends { inject: infer I } ? I : never;
