import type { Token, TokenRegistry } from './token.js'

type ResolveToken<
  TToken,
  TRegistry extends TokenRegistry,
> = TToken extends keyof TRegistry
  ? TRegistry[TToken]
  : TToken extends abstract new (...args: unknown[]) => infer R
    ? R
    : unknown

export type InferDeps<
  TInjectMap extends Record<string, Token>,
  TRegistry extends TokenRegistry = TokenRegistry,
> = {
  [K in keyof TInjectMap]: ResolveToken<TInjectMap[K], TRegistry>
}

export type Deps<TClass extends { inject: Record<string, Token> }> =
  InferDeps<TClass['inject']>


/**
 * InjectableClass represents a class constructor with static inject property
 *
 * @template TInject - The type of the inject map (Record<string, Token>)
 * @template TInstance - The type of instance the class creates
 */
export type InjectableClass<
  TInject extends Record<string, Token> = Record<string, Token>,
  TInstance = unknown,
> = (new (deps: InferDeps<TInject>) => TInstance) & {
  inject: TInject
}

/**
 * Helper type to extract the inject map from a class
 */
export type ExtractInject<T> = T extends { inject: infer I } ? I : never