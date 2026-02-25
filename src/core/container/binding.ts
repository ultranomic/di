import type { Token } from '../types/token.ts';

/**
 * Binding scope determines the lifecycle of a provider
 */
export const Scope = {
  SINGLETON: 'singleton',
  TRANSIENT: 'transient',
  SCOPED: 'scoped',
} as const;

export type Scope = (typeof Scope)[keyof typeof Scope];

/**
 * RegisterOptions for class registration
 */
export interface RegisterOptions {
  scope?: Scope;
}

/**
 * Forward declaration of Container type to avoid circular dependency
 */
export type ContainerLike = {
  resolve<T>(token: Token<T>): T;
};

/**
 * Binding represents a provider registration in the container
 */
export interface Binding<T = unknown> {
  /** The token used to identify this binding (is the class constructor) */
  readonly token: Token<T>;
  /** The scope of this binding */
  scope: Scope;
  /** Cached instance for singleton scope */
  instance?: T;
}
