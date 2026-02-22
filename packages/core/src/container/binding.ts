import type { Token } from '../types/token.js'

/**
 * Binding scope determines the lifecycle of a provider
 */
export enum BindingScope {
  SINGLETON = 'SINGLETON',
  TRANSIENT = 'TRANSIENT',
  SCOPED = 'SCOPED',
}

/**
 * Forward declaration of Container type to avoid circular dependency
 */
export type ContainerLike = {
  resolve<T>(token: Token<T>): T
}

/**
 * Binding represents a provider registration in the container
 *
 * @template T - The type of value the binding produces
 */
export interface Binding<T = unknown> {
  /** The token used to identify this binding */
  readonly token: Token<T>
  /** Factory function that creates the value */
  readonly factory: (container: ContainerLike) => T
  /** The scope of this binding */
  scope: BindingScope
  /** Cached instance for singleton scope */
  instance?: T
}

/**
 * BindingBuilder provides a fluent API for configuring bindings
 *
 * @template T - The type of value the binding produces
 */
export class BindingBuilder<T> {
  constructor(
    private readonly binding: Binding<T>,
  ) {}

  /**
   * Configure the binding as a singleton
   *
   * Singletons are instantiated once and cached for the lifetime
   * of the container.
   */
  asSingleton(): void {
    this.binding.scope = BindingScope.SINGLETON
  }

  /**
   * Configure the binding as transient
   *
   * Transient bindings create a new instance on every resolution.
   * This is the default scope.
   */
  asTransient(): void {
    this.binding.scope = BindingScope.TRANSIENT
  }

  /**
   * Configure the binding as request-scoped
   *
   * Request-scoped bindings create one instance per request scope.
   */
  asScoped(): void {
    this.binding.scope = BindingScope.SCOPED
  }
}
