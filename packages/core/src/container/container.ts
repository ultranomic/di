import type { Token } from '../types/token.js'
import { BindingScope, type Binding, BindingBuilder } from './binding.js'
import type {
  ContainerInterface,
  ResolverInterface,
} from './interfaces.js'
import { TokenNotFoundError } from '../errors/token-not-found.js'

interface ResolutionContext {
  path: Token[]
}

interface CircularProxyState {
  token: Token
  getBinding: () => Binding | undefined
}

export class Container implements ContainerInterface {
  private readonly bindings = new Map<Token, Binding>()

  register<T>(
    token: Token<T>,
    factory: (container: ResolverInterface) => T,
  ): BindingBuilder<T> {
    const binding: Binding<T> = {
      token,
      factory: factory as (container: { resolve<T>(token: Token<T>): T }) => T,
      scope: BindingScope.TRANSIENT,
    }
    this.bindings.set(token, binding as Binding)
    return new BindingBuilder(binding)
  }

  resolve<T>(token: Token<T>): T {
    return this.resolveWithContext(token, { path: [] })
  }

  buildDeps<TInjectMap extends Record<string, Token>>(
    injectMap: TInjectMap,
  ): Record<string, unknown> {
    const deps: Record<string, unknown> = {}
    for (const [key, token] of Object.entries(injectMap)) {
      deps[key] = this.resolve(token)
    }
    return deps
  }

  private buildDepsWithContext<TInjectMap extends Record<string, Token>>(
    injectMap: TInjectMap,
    context: ResolutionContext,
  ): Record<string, unknown> {
    const deps: Record<string, unknown> = {}
    for (const [key, token] of Object.entries(injectMap)) {
      deps[key] = this.resolveWithContext(token, context)
    }
    return deps
  }

  getResolutionPath(context: ResolutionContext): string {
    if (context.path.length === 0) {
      return ''
    }
    return ' -> ' + context.path.map((t) => String(t)).join(' -> ')
  }

  private resolveWithContext<T>(token: Token<T>, context: ResolutionContext): T {
    const binding = this.bindings.get(token) as Binding<T> | undefined
    if (!binding) {
      const resolutionPath = context.path.map((t) => String(t))
      const availableTokens = Array.from(this.bindings.keys()).map((t) => String(t))
      throw new TokenNotFoundError(token, resolutionPath, availableTokens)
    }
    if (binding.scope === BindingScope.SINGLETON && binding.instance !== undefined) {
      return binding.instance
    }
    if (context.path.includes(token)) {
      return this.createCircularProxy(token) as T
    }
    context.path.push(token)

    const bindings = this.bindings
    const contextResolver: ResolverInterface = {
      resolve: <TResolve>(resolveToken: Token<TResolve>): TResolve =>
        this.resolveWithContext(resolveToken, context),
      has: (checkToken: Token) => bindings.has(checkToken),
      buildDeps: <TInjectMap extends Record<string, Token>>(injectMap: TInjectMap) =>
        this.buildDepsWithContext(injectMap, context),
    }
    const instance = binding.factory(contextResolver)
    if (binding.scope === BindingScope.SINGLETON) {
      binding.instance = instance
    }
    return instance
  }
  has(token: Token): boolean {
    return this.bindings.has(token)
  }
  getBinding<T>(token: Token<T>): Binding<T> | undefined {
    return this.bindings.get(token) as Binding<T> | undefined
  }
  clear(): void {
    this.bindings.clear()
  }

  private createCircularProxy<T>(token: Token<T>): T {
    const bindings = this.bindings

    const state: CircularProxyState = {
      token,
      getBinding: () => bindings.get(token) as Binding | undefined,
    }

    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === 'then') {
          return undefined
        }

        if (prop === 'toString') {
          return () => `[CircularProxy: ${String(token)}]`
        }

        if (prop === Symbol.toStringTag) {
          return 'CircularProxy'
        }

        const binding = state.getBinding()
        if (binding?.instance) {
          const actual = binding.instance as Record<string | symbol, unknown>
          const value = actual[prop]
          if (typeof value === 'function') {
            return value.bind(actual)
          }
          return value
        }

        return undefined
      },
    }

    return new Proxy({}, handler) as T
  }
}
