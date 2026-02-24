import {
  Container,
  type Token,
  type ResolverInterface,
  Module,
  type ModuleMetadata,
  ModuleRegistry,
  type ModuleConstructor,
} from '@voxeljs/core'

interface TestModuleConfig {
  imports?: readonly ModuleConstructor[]
  providers?: readonly unknown[]
  controllers?: readonly unknown[]
}

interface ProviderOverride {
  token: Token
  factory: (container: ResolverInterface) => unknown
}

export class TestingModule {
  constructor(private readonly container: Container) {}

  get<T>(token: Token<T>): T {
    return this.container.resolve(token)
  }

  has(token: Token): boolean {
    return this.container.has(token)
  }
}

export class TestModuleBuilder {
  private readonly config: TestModuleConfig
  private readonly overrides: ProviderOverride[] = []
  private readonly extraProviders: Array<{
    token: Token
    factory: (container: ResolverInterface) => unknown
  }> = []

  constructor(config: TestModuleConfig) {
    this.config = config
  }

  overrideProvider<T>(
    token: Token<T>,
    implementation: T,
  ): TestModuleBuilder {
    this.overrides.push({
      token,
      factory: () => implementation,
    })
    return this
  }

  overrideProviderFactory<T>(
    token: Token<T>,
    factory: (container: ResolverInterface) => T,
  ): TestModuleBuilder {
    this.overrides.push({ token, factory })
    return this
  }

  addProvider<T>(token: Token<T>, implementation: T): TestModuleBuilder {
    this.extraProviders.push({
      token,
      factory: () => implementation,
    })
    return this
  }

  async compile(): Promise<TestingModule> {
    const container = new Container()
    const registry = new ModuleRegistry()

    // Register overrides FIRST so they take precedence
    // Module registration will skip tokens that are already registered
    const overrideTokens = new Set<Token>()
    for (const override of this.overrides) {
      container.register(override.token, override.factory)
      overrideTokens.add(override.token)
    }

    for (const module of this.config.imports ?? []) {
      registry.register(module)
    }

    const testModule = this.createTestModule(overrideTokens)
    registry.register(testModule)

    await registry.loadModules(container)

    for (const provider of this.extraProviders) {
      container.register(provider.token, provider.factory)
    }

    return new TestingModule(container)
  }

  private createTestModule(overrideTokens: Set<Token>): ModuleConstructor {
    const providers = this.config.providers ?? []
    const controllers = this.config.controllers ?? []

    const overrideTokensRef = overrideTokens

    class DynamicTestModule extends Module {
      static readonly metadata: ModuleMetadata = {
        imports: [],
        providers: providers,
        controllers: controllers,
        exports: [],
      }

      register(container: Container): void {
        for (const provider of providers) {
          if (typeof provider === 'function') {
            const ProviderClass = provider as {
              new (...args: unknown[]): unknown
              inject?: Record<string, Token> | readonly unknown[]
            }
            // Skip if this provider is being overridden
            if (overrideTokensRef.has(ProviderClass)) {
              continue
            }
            if (ProviderClass.inject) {
              container.register(ProviderClass, (c: ResolverInterface) => {
                const inject = ProviderClass.inject!
                // Check if inject is an object (new DepsTokens pattern) or array (old pattern)
                if (Array.isArray(inject)) {
                  // Array pattern: dependencies as positional constructor parameters
                  const deps = c.buildDeps(inject as readonly Token[])
                  return new ProviderClass(...(deps as unknown[]))
                } else {
                  // Object pattern: dependencies as named object parameter
                  const injectObj = inject as Record<string, Token>
                  const tokens = Object.values(injectObj)
                  const resolvedValues = c.buildDeps(tokens)
                  // Build object with same keys as inject
                  const depsObj: Record<string, unknown> = {}
                  let i = 0
                  for (const key of Object.keys(injectObj)) {
                    depsObj[key] = resolvedValues[i++]
                  }
                  return new ProviderClass(depsObj)
                }
              })
            } else {
              container.register(ProviderClass, () => new ProviderClass())
            }
          }
        }
      }
    }

    return DynamicTestModule
  }
}

export const Test = {
  createModule(config: TestModuleConfig = {}): TestModuleBuilder {
    return new TestModuleBuilder(config)
  },
}
