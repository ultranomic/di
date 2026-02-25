import type { Injectable } from '../types/injectable.ts';

type InjectableConstructor = abstract new (...args: any[]) => Injectable;

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
  resolve<T extends Injectable>(token: abstract new (...args: any[]) => T): T;
};

/**
 * Binding represents a provider registration in the container
 */
export interface Binding<T extends Injectable = Injectable> {
  /** The token used to identify this binding (is the class constructor) */
  readonly token: InjectableConstructor;
  /** The scope of this binding */
  scope: Scope;
  /** Cached instance for singleton scope */
  instance?: T;
}
