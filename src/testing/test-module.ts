import {
  Container,
  type ResolverInterface,
  Module,
  type ModuleMetadata,
  ModuleRegistry,
  type ModuleConstructor,
} from '../core/index.js';

interface TestModuleConfig {
  imports?: readonly ModuleConstructor[];
  providers?: readonly unknown[];
  controllers?: readonly unknown[];
}

interface ProviderOverride {
  token: abstract new (...args: unknown[]) => unknown;
  factory: (container: ResolverInterface) => unknown;
}

export class TestingModule {
  private readonly container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  get<T>(token: abstract new (...args: unknown[]) => T): T {
    return this.container.resolve(token);
  }

  has(token: abstract new (...args: unknown[]) => unknown): boolean {
    return this.container.has(token);
  }
}

export class TestModuleBuilder {
  private readonly config: TestModuleConfig;
  private readonly overrides: ProviderOverride[] = [];
  private readonly extraProviders: Array<{
    token: abstract new (...args: unknown[]) => unknown;
    factory: (container: ResolverInterface) => unknown;
  }> = [];

  constructor(config: TestModuleConfig) {
    this.config = config;
  }

  overrideProvider<T>(token: abstract new (...args: unknown[]) => T, implementation: T): TestModuleBuilder {
    this.overrides.push({
      token,
      factory: () => implementation,
    });
    return this;
  }

  overrideProviderFactory<T>(
    token: abstract new (...args: unknown[]) => T,
    factory: (container: ResolverInterface) => T,
  ): TestModuleBuilder {
    this.overrides.push({ token, factory });
    return this;
  }

  addProvider<T>(token: abstract new (...args: unknown[]) => T, implementation: T): TestModuleBuilder {
    this.extraProviders.push({
      token,
      factory: () => implementation,
    });
    return this;
  }

  async compile(): Promise<TestingModule> {
    const container = new Container();
    const registry = new ModuleRegistry();

    // Register overrides FIRST so they take precedence
    // Module registration will skip tokens that are already registered
    const overrideTokens = new Set<abstract new (...args: unknown[]) => unknown>();
    for (const override of this.overrides) {
      container.register(override.token, override.factory);
      overrideTokens.add(override.token);
    }

    for (const module of this.config.imports ?? []) {
      registry.register(module);
    }

    const testModule = this.createTestModule(overrideTokens);
    registry.register(testModule);

    await registry.loadModules(container);

    for (const provider of this.extraProviders) {
      container.register(provider.token, provider.factory);
    }

    return new TestingModule(container);
  }

  private createTestModule(
    overrideTokens: Set<abstract new (...args: unknown[]) => unknown>,
  ): ModuleConstructor {
    const providers = this.config.providers ?? [];
    const controllers = this.config.controllers ?? [];

    const overrideTokensRef = overrideTokens;

    class DynamicTestModule extends Module {
      static readonly metadata: ModuleMetadata = {
        imports: [],
        providers: providers,
        controllers: controllers,
        exports: [],
      };

      register(container: Container): void {
        for (const provider of providers) {
          if (typeof provider === 'function') {
            const ProviderClass = provider as {
              new (...args: unknown[]): unknown;
              inject?: readonly unknown[];
            };
            // Skip if this provider is being overridden
            if (overrideTokensRef.has(ProviderClass as abstract new (...args: unknown[]) => unknown)) {
              continue;
            }
            if (ProviderClass.inject) {
              container.register(ProviderClass, (c: ResolverInterface) => {
                // Array pattern: dependencies as positional constructor parameters
                const deps = c.buildDeps(ProviderClass.inject as readonly (abstract new (...args: unknown[]) => unknown)[]);
                return new ProviderClass(...(deps as unknown[]));
              });
            } else {
              container.register(ProviderClass, () => new ProviderClass());
            }
          }
        }
      }
    }

    return DynamicTestModule;
  }
}

export const Test = {
  createModule(config: TestModuleConfig = {}): TestModuleBuilder {
    return new TestModuleBuilder(config);
  },
};
