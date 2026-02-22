import type { BindingBuilder, Binding } from './binding.js'
import type { Token } from '../types/token.js'

/**
 * ResolverInterface provides read-only access to resolve dependencies
 *
 * Use this interface when you only need to resolve tokens without
 * modifying the container.
 */
export interface ResolverInterface {
  /**
   * Resolve a token to its value
   *
   * @template T - The expected type of the resolved value
   * @param token - The token to resolve
   * @returns The resolved value
   * @throws Error if the token is not registered
   */
  resolve<T>(token: Token<T>): T

  /**
   * Check if a token is registered
   *
   * @param token - The token to check
   * @returns true if the token is registered
   */
  has(token: Token): boolean
}

/**
 * ContainerInterface provides full access to the container
 *
 * Use this interface when you need to both register and resolve
 * dependencies.
 */
export interface ContainerInterface extends ResolverInterface {
  /**
   * Register a provider with the container
   *
   * @template T - The type of value the factory produces
   * @param token - The token to register
   * @param factory - Factory function that creates the value
   * @returns A BindingBuilder for configuring the binding scope
   */
  register<T>(
    token: Token<T>,
    factory: (container: ResolverInterface) => T,
  ): BindingBuilder<T>

  /**
   * Get a binding by token
   *
   * @template T - The expected type of the binding
   * @param token - The token to look up
   * @returns The binding if found, undefined otherwise
   */
  getBinding<T>(token: Token<T>): Binding<T> | undefined

  /**
   * Clear all bindings from the container
   */
  clear(): void
}
