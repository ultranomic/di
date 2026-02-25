import type { Token } from '../types/token.ts';
import type { Binding, RegisterOptions } from './binding.ts';
import type { InferInjectedInstanceTypes } from '../types/dependencies.ts';

export interface ResolverInterface {
  resolve<T>(token: Token<T>): T;
  has(token: Token): boolean;
  buildDependencies<TTokens extends readonly Token[]>(tokens: TTokens): InferInjectedInstanceTypes<TTokens>;
}

export interface ContainerInterface extends ResolverInterface {
  register<T extends abstract new (...args: unknown[]) => unknown>(token: T, options?: RegisterOptions): void;
  getBinding<T>(token: Token<T>): Binding<T> | undefined;
  clear(): void;
}
