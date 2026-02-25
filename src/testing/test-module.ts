import {
  Container,
  Module,
  ModuleRegistry,
  type InjectableConstructor,
  type ModuleConstructor,
  type ModuleMetadata,
} from '../core/index.js';
import type { Injectable } from '../core/types/injectable.ts';

interface TestModuleConfig {
  imports?: readonly ModuleConstructor[];
  providers?: readonly InjectableConstructor[];
  controllers?: readonly InjectableConstructor[];
}

/**
 * TestingModule provides access to the compiled test container
 */
export class TestingModule {
  private readonly container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  get<T extends Injectable>(token: InjectableConstructor<T>): T {
    return this.container.resolve(token);
  }

  has(token: InjectableConstructor): boolean {
    return this.container.has(token);
  }
}

/**
 * TestModuleBuilder provides a fluent API for configuring test modules
 */
export class TestModuleBuilder {
  private readonly config: TestModuleConfig;

  constructor(config: TestModuleConfig) {
    this.config = config;
  }

  async compile(): Promise<TestingModule> {
    const container = new Container();
    const registry = new ModuleRegistry();

    // Create and register test module
    const testModule = this.createTestModule();
    registry.register(testModule);

    await registry.loadModules(container);

    return new TestingModule(container);
  }

  private createTestModule(): ModuleConstructor {
    const providers = this.config.providers ?? [];
    const controllers = this.config.controllers ?? [];

    class DynamicTestModule extends Module {
      static readonly metadata: ModuleMetadata = {
        imports: [],
        providers: providers,
        controllers: controllers,
        exports: [],
      };
    }

    return DynamicTestModule;
  }
}

export const Test = {
  createModule(config: TestModuleConfig = {}): TestModuleBuilder {
    return new TestModuleBuilder(config);
  },
};
