import type { Token } from '../types/token.ts';
import type { Binding, BindingBuilder } from './binding.ts';
import type { InferInject } from '../types/deps.ts';

export interface ResolverInterface {
  resolve<T>(token: Token<T>): T;
  has(token: Token): boolean;
  buildDeps<TTokens extends readonly Token[]>(tokens: TTokens): InferInject<TTokens>;
}

export interface ContainerInterface extends ResolverInterface {
  register<T>(token: Token<T>, factory: (container: ResolverInterface) => T): BindingBuilder<T>;
  getBinding<T>(token: Token<T>): Binding<T> | undefined;
  clear(): void;
}
