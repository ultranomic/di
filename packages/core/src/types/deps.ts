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
