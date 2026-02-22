import type { Token } from '../types/token.js'
import { BindingScope, type Binding, BindingBuilder } from './binding.js'
import type {
  ContainerInterface,
  ResolverInterface,
} from './interfaces.js'

/**
 * ResolutionContext tracks the resolution path for error messages
 */
interface ResolutionContext {
  /** The chain of tokens being resolved */
  path: Token[]
}

/**
 * DI Container for managing provider registration and resolution
 *
 * @example
 * ```typescript
 * const container = new Container()
 *
 * container.register('Logger', () => new ConsoleLogger()).asSingleton()
 * container.register('Database', (c) => new Database(c.resolve('Logger')))
 *
 * const db = container.resolve('Database')
 * ```
 */
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

  /**
   * Build a deps object from an inject map
   *
   * This is used to resolve all dependencies for a class that uses
   * the static inject pattern.
   *
   * @param injectMap - The static inject property from a class
   * @param context - The resolution context for tracking
   * @returns A deps object with all dependencies resolved
   */
  buildDeps<TInjectMap extends Record<string, Token>>(
    injectMap: TInjectMap,
  ): Record<string, unknown> {
    const deps: Record<string, unknown> = {}
    for (const [key, token] of Object.entries(injectMap)) {
      deps[key] = this.resolve(token)
    }
    return deps
  }

  /**
   * Get the current resolution path as a formatted string
   *
   * @param context - The resolution context
   * @returns Formatted resolution path string
   */
  getResolutionPath(context: ResolutionContext): string {
    if (context.path.length === 0) {
      return ''
    }
    return ' -> ' + context.path.map((t) => String(t)).join(' -> ')
  }

  /**
   * Internal resolve with context tracking
   *
   * @param token - The token to resolve
   * @param context - The resolution context for tracking
   * @returns The resolved value
   */
  private resolveWithContext<T>(token: Token<T>, context: ResolutionContext): T {
    const binding = this.bindings.get(token) as Binding<T> | undefined
    if (!binding) {
      const resolutionPath = this.getResolutionPath(context)
      const availableTokens = Array.from(this.bindings.keys())
        .map((t) => String(t))
        .join(', ')
      throw new Error(
        `Token not found: ${String(token)}${resolutionPath}\n  Available tokens: ${availableTokens || 'none'}`,
      )
    }
    // Return cached singleton
    if (binding.scope === BindingScope.SINGLETON && binding.instance !== undefined) {
      return binding.instance
    }
    // Track resolution path
    context.path.push(token)
    const instance = binding.factory(this)
    // Cache singleton
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

}