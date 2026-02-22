import type { Token } from '../types/token.js'
import { BindingScope, type Binding, BindingBuilder } from './binding.js'
import type {
  ContainerInterface,
  ResolverInterface,
} from './interfaces.js'

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
    const binding = this.bindings.get(token) as Binding<T> | undefined
    if (!binding) {
      throw new Error(`Token not found: ${String(token)}`)
    }

    if (binding.scope === BindingScope.SINGLETON && binding.instance !== undefined) {
      return binding.instance
    }

    const instance = binding.factory(this)

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
