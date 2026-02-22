import type { BindingBuilder, Binding } from './binding.js'
import type { Token } from '../types/token.js'

export interface ResolverInterface {
  resolve<T>(token: Token<T>): T
  has(token: Token): boolean
  buildDeps<TInjectMap extends Record<string, Token>>(
    injectMap: TInjectMap,
  ): Record<string, unknown>
}

export interface ContainerInterface extends ResolverInterface {
  register<T>(
    token: Token<T>,
    factory: (container: ResolverInterface) => T,
  ): BindingBuilder<T>
  getBinding<T>(token: Token<T>): Binding<T> | undefined
  clear(): void
}
