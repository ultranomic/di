import { ScopeValidationError } from '../errors/scope-validation.ts';
import { TokenCollisionError } from '../errors/token-collision.ts';
import { TokenNotFoundError } from '../errors/token-not-found.ts';
import type { Token } from '../types/token.ts';
import type { InferInject } from '../types/deps.ts';
import { Scope, type Binding, type RegisterOptions } from './binding.ts';
import type { ContainerInterface, ResolverInterface } from './interfaces.ts';

interface ResolutionContext {
  path: Token[];
}

interface CircularProxyState {
  token: Token;
  getBinding: () => Binding | undefined;
}

export class Container implements ContainerInterface {
  private readonly parent: Container | undefined;
  private readonly bindings = new Map<Token, Binding>();
  private readonly scopedCache = new Map<Token, unknown>();

  constructor(parent?: Container) {
    this.parent = parent;
  }

  createScope(): Container {
    return new Container(this);
  }

  isRoot(): boolean {
    return this.parent === undefined;
  }

  private getRoot(): Container {
    if (this.parent === undefined) {
      return this;
    }
    return this.parent.getRoot();
  }

  register<T extends abstract new (...args: unknown[]) => unknown>(
    token: T,
    options?: RegisterOptions,
  ): void {
    if (this.parent !== undefined) {
      throw new Error(
        `Cannot register bindings in child container. Token: ${String(token)}. ` +
          `Register providers in the root container only.`,
      );
    }

    // Validate that class has static inject
    const ClassWithInject = token as typeof token & {
      inject?: readonly unknown[];
    };
    if (
      !('inject' in ClassWithInject) ||
      ClassWithInject.inject === undefined ||
      !Array.isArray(ClassWithInject.inject)
    ) {
      throw new Error(
        `Class '${token.name}' must have a static inject property. ` +
          `Add: static readonly inject = [] as const satisfies DepsTokens<${token.name}>`,
      );
    }

    if (this.bindings.has(token)) {
      throw new TokenCollisionError(token, 'existing', 'new');
    }

    const binding: Binding<InstanceType<T>> = {
      token,
      classConstructor: token,
      scope: options?.scope ?? Scope.SINGLETON,
    };
    this.bindings.set(token, binding as Binding);
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
    if (binding === undefined) {
      throw new TokenNotFoundError(token, context.path, Array.from(this.getAllBindings().keys()));
    }

    // Return cached singleton instance
    if (binding.scope === Scope.SINGLETON && binding.instance !== undefined) {
      return binding.instance;
    }

    // Return cached scoped instance
    if (binding.scope === Scope.SCOPED && this.scopedCache.has(token)) {
      return this.scopedCache.get(token) as T;
    }

    // Handle circular dependencies
    if (context.path.includes(token)) {
      return this.createCircularProxy(token) as T;
    }
    context.path.push(token);

    const contextResolver: ResolverInterface = {
      resolve: <TResolve>(resolveToken: Token<TResolve>): TResolve =>
        this.resolveWithContext(resolveToken, context),
      has: (checkToken: Token) => this.has(checkToken),
      buildDeps: <TTokens extends readonly Token[]>(tokens: TTokens) =>
        this.buildDepsWithContext(tokens, context),
    };

    // Auto-instantiate using inject property
    const instance = this.createInstance(binding.classConstructor, contextResolver);

    // Cache instances for singleton and scoped bindings
    if (binding.scope === Scope.SINGLETON) {
      binding.instance = instance;
    } else if (binding.scope === Scope.SCOPED) {
      this.scopedCache.set(token, instance);
    }

    return instance;
  }

  private createInstance<T>(
    ClassConstructor: abstract new (...args: unknown[]) => T,
    resolver: ResolverInterface,
  ): T {
    const ClassWithInject = ClassConstructor as typeof ClassConstructor & {
      inject?: readonly Token[];
    };

    if (
      'inject' in ClassWithInject &&
      ClassWithInject.inject !== undefined &&
      Array.isArray(ClassWithInject.inject)
    ) {
      const deps = resolver.buildDeps(ClassWithInject.inject);
      return new ClassConstructor(...(deps as unknown[]));
    }

    return new ClassConstructor();
  }

  has(token: Token): boolean {
    return this.bindings.has(token) || (this.parent?.has(token) ?? false);
  }

  getBinding<T>(token: Token<T>): Binding<T> | undefined {
    const binding = this.bindings.get(token) as Binding<T> | undefined;
    if (binding !== undefined) {
      return binding;
    }
    return this.parent?.getBinding(token);
  }

  private getAllBindings(): Map<Token, Binding> {
    if (this.parent === undefined) {
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
    if (this.parent !== undefined) {
      // Child containers only clear their scoped cache
      this.scopedCache.clear();
    } else {
      // Root containers clear both bindings and scoped cache
      this.bindings.clear();
      this.scopedCache.clear();
    }
  }

  validateScopes(): void {
    if (this.parent !== undefined) {
      throw new Error('validateScopes() must be called on the root container');
    }

    for (const [token, binding] of this.bindings) {
      if (binding.scope === Scope.SINGLETON) {
        this.validateSingletonDependencies(token, binding);
      }
    }
  }

  private validateSingletonDependencies(token: Token, binding: Binding): void {
    const deps = this.extractDependenciesFromClass(binding.classConstructor);
    for (const depToken of deps) {
      const depBinding = this.getBinding(depToken);
      if (depBinding?.scope === Scope.SCOPED) {
        throw new ScopeValidationError(token, depToken);
      }
    }
  }

  private extractDependenciesFromClass(
    ClassConstructor: abstract new (...args: unknown[]) => unknown,
  ): Token[] {
    const ClassWithInject = ClassConstructor as typeof ClassConstructor & {
      inject?: readonly Token[];
    };

    if (
      'inject' in ClassWithInject &&
      ClassWithInject.inject !== undefined &&
      Array.isArray(ClassWithInject.inject)
    ) {
      return [...ClassWithInject.inject];
    }

    return [];
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
