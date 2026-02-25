import type { InferInjectedInstanceTypes } from '../types/dependencies.ts';
import type { Injectable, InjectableConstructor } from '../types/injectable.ts';
import type { Binding, RegisterOptions } from './binding.ts';

export interface ResolverInterface {
  resolve<T extends Injectable>(token: InjectableConstructor<T>): T;
  has(token: InjectableConstructor): boolean;
  buildDependencies<TTokens extends readonly InjectableConstructor[]>(
    tokens: TTokens,
  ): InferInjectedInstanceTypes<TTokens>;
}

export interface ContainerInterface extends ResolverInterface {
  register(token: InjectableConstructor, options?: RegisterOptions): void;
  getBinding<T extends Injectable>(token: InjectableConstructor<T>): Binding<T> | undefined;
  clear(): void;
}
