import type { Injectable } from '../types/injectable.ts';
import type { Binding, RegisterOptions } from './binding.ts';
import type { InferInjectedInstanceTypes } from '../types/dependencies.ts';

export interface ResolverInterface {
  resolve<T extends Injectable>(token: abstract new (...args: any[]) => T): T;
  has(token: abstract new (...args: any[]) => Injectable): boolean;
  buildDependencies<TTokens extends readonly (abstract new (...args: any[]) => Injectable)[]>(tokens: TTokens): InferInjectedInstanceTypes<TTokens>;
}

export interface ContainerInterface extends ResolverInterface {
  register(token: abstract new (...args: any[]) => Injectable, options?: RegisterOptions): void;
  getBinding<T extends Injectable>(token: abstract new (...args: any[]) => T): Binding<T> | undefined;
  clear(): void;
}
