import { ScopeValidationError } from '../errors/scope-validation.ts';
import { TokenCollisionError } from '../errors/token-collision.ts';
import { TokenNotFoundError } from '../errors/token-not-found.ts';
import type { Token } from '../types/token.ts';
import type { InferInject } from '../types/deps.ts';
import { BindingBuilder, BindingScope, type Binding } from './binding.ts';
import type { ContainerInterface, ResolverInterface } from './interfaces.ts';

interface ResolutionContext {
  path: Token[];
}

interface CircularProxyState {
  token: Token;
  getBinding: () => Binding | undefined;
}

export class Container implements ContainerInterface {
  private readonly parent?: Container;
  private readonly bindings = new Map<Token, Binding>();
  private readonly scopedCache = new Map<Token, unknown>();

  constructor(parent?: Container) {
    if (parent !== undefined) {
      this.parent = parent;
    }
  }

  createScope(): Container {
    return new Container(this);
  }

  isRoot(): boolean {
    return !this.parent;
  }

  private getRoot(): Container {
    return this.parent ? this.parent.getRoot() : this;
  }

  register<T>(token: Token<T>, factory: (container: ResolverInterface) => T): BindingBuilder<T> {
    if (this.parent) {
      throw new Error(
        `Cannot register bindings in child container. Token: ${String(token)}. ` +
          `Register providers in the root container only.`,
      );
    }
    if (this.bindings.has(token)) {
      const existingBinding = this.bindings.get(token);
      throw new TokenCollisionError(token, existingBinding?.factory.name || 'Unknown', factory.name || 'Unknown');
    }
    const binding: Binding<T> = {
      token,
      factory: factory as (container: { resolve<T>(token: Token<T>): T }) => T,
      scope: BindingScope.TRANSIENT,
    };
    this.bindings.set(token, binding as Binding);
    return new BindingBuilder(binding);
  }

  resolve<T>(token: Token<T>): T {
    return this.resolveWithContext(token, { path: [] });
  }

  buildDeps<TTokens extends readonly Token[]>(tokens: TTokens): InferInject<TTokens> {
    const resolvedTokens = tokens.map((token) => this.resolve(token));
    return resolvedTokens as InferInject<TTokens>;
  }

  private buildDepsWithContext<TTokens extends readonly Token[]>(
    tokens: TTokens,
    context: ResolutionContext,
  ): InferInject<TTokens> {
    const resolvedTokens = tokens.map((token) => this.resolveWithContext(token, context));
    return resolvedTokens as InferInject<TTokens>;
  }

  getResolutionPath(context: ResolutionContext): string {
    if (context.path.length === 0) {
      return '';
    }
    return ' -> ' + context.path.map((t) => String(t)).join(' -> ');
  }

  private resolveWithContext<T>(token: Token<T>, context: ResolutionContext): T {
    const binding = this.getBinding(token);
    if (!binding) {
      throw new TokenNotFoundError(token, context.path, Array.from(this.getAllBindings().keys()));
    }

    if (binding.scope === BindingScope.SINGLETON && binding.instance !== undefined) {
      return binding.instance;
    }

    if (binding.scope === BindingScope.SCOPED) {
      if (this.scopedCache.has(token)) {
        return this.scopedCache.get(token) as T;
      }
    }

    if (context.path.includes(token)) {
      return this.createCircularProxy(token) as T;
    }
    context.path.push(token);

    const contextResolver: ResolverInterface = {
      resolve: <TResolve>(resolveToken: Token<TResolve>): TResolve => this.resolveWithContext(resolveToken, context),
      has: (checkToken: Token) => this.has(checkToken),
      buildDeps: <TTokens extends readonly Token[]>(tokens: TTokens) => this.buildDepsWithContext(tokens, context),
    };
    const instance = binding.factory(contextResolver);

    if (binding.scope === BindingScope.SINGLETON) {
      binding.instance = instance;
    } else if (binding.scope === BindingScope.SCOPED) {
      this.scopedCache.set(token, instance);
    }

    return instance;
  }

  has(token: Token): boolean {
    if (this.bindings.has(token)) {
      return true;
    }
    return this.parent?.has(token) ?? false;
  }

  getBinding<T>(token: Token<T>): Binding<T> | undefined {
    const binding = this.bindings.get(token) as Binding<T> | undefined;
    if (binding) {
      return binding;
    }
    return this.parent?.getBinding(token);
  }

  private getAllBindings(): Map<Token, Binding> {
    if (!this.parent) {
      return this.bindings;
    }
    const allBindings = new Map<Token, Binding>();
    const parentBindings = this.parent.getAllBindings();
    for (const [token, binding] of parentBindings) {
      allBindings.set(token, binding);
    }
    for (const [token, binding] of this.bindings) {
      allBindings.set(token, binding);
    }
    return allBindings;
  }

  clear(): void {
    if (this.parent) {
      this.scopedCache.clear();
    } else {
      this.bindings.clear();
      this.scopedCache.clear();
    }
  }

  validateScopes(): void {
    if (this.parent) {
      throw new Error('validateScopes() must be called on the root container');
    }

    for (const [token, binding] of this.bindings) {
      if (binding.scope === BindingScope.SINGLETON) {
        this.validateSingletonDependencies(token, binding);
      }
    }
  }

  private validateSingletonDependencies(token: Token, binding: Binding): void {
    const deps = this.extractDependenciesFromFactory(binding.factory);
    for (const depToken of deps) {
      const depBinding = this.getBinding(depToken);
      if (depBinding?.scope === BindingScope.SCOPED) {
        throw new ScopeValidationError(token, depToken);
      }
    }
  }

  private extractDependenciesFromFactory(factory: (container: ContainerLike) => unknown): Token[] {
    const dependencies: Token[] = [];
    const capturedTokens: Token[] = [];

    const probeResolver: ContainerLike = {
      resolve: <T>(token: Token<T>): T => {
        capturedTokens.push(token);
        return this.createStubForToken(token) as T;
      },
    };

    try {
      factory(probeResolver);
    } catch {
      // Factory might throw when receiving stub values, that's OK
    }

    dependencies.push(...capturedTokens);
    return dependencies;
  }

  private createStubForToken(token: Token): object {
    const tokenStr = typeof token === 'function' ? token.name : String(token);

    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return undefined;
          }
          if (prop === 'toString' || prop === Symbol.toStringTag) {
            return `[Stub: ${tokenStr}]`;
          }
          if (prop === 'inspect') {
            return () => `[Stub: ${tokenStr}]`;
          }
          return () => {};
        },
      },
    );
  }

  private createCircularProxy<T>(token: Token<T>): T {
    const getBinding = (): Binding | undefined => this.getBinding(token) as Binding | undefined;
    const state: CircularProxyState = {
      token,
      getBinding,
    };
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === 'then') {
          return undefined;
        }
        if (prop === 'toString') {
          return () => `[CircularProxy: ${String(token)}]`;
        }
        if (prop === Symbol.toStringTag) {
          return 'CircularProxy';
        }
        if (prop === 'inspect') {
          return () => `[CircularProxy: ${String(token)}]`;
        }
        const binding = state.getBinding();
        if (binding?.instance) {
          const actual = binding.instance as Record<string | symbol, unknown>;
          const value = actual[prop];
          if (typeof value === 'function') {
            return value.bind(actual);
          }
          return value;
        }

        return undefined;
      },
    };
    return new Proxy({}, handler) as T;
  }
}

type ContainerLike = {
  resolve<T>(token: Token<T>): T;
};
