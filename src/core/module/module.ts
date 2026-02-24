import type { ContainerInterface, ResolverInterface } from '../container/interfaces.ts';
import type { ModuleMetadata, OnModuleDestroy, OnModuleInit } from '../types/module.ts';
import type { Token } from '../types/token.ts';

export type { ModuleMetadata } from '../types/module.ts';

/**
 * Abstract base class for Voxel modules
 *
 * Modules encapsulate providers, controllers, and imports to create
 * a cohesive unit of functionality.
 *
 * @example
 * // Simple module with auto-registration
 * class UserModule extends Module {
 *   static readonly metadata: ModuleMetadata = {
 *     imports: [DatabaseModule],
 *     providers: [UserService, UserRepository],
 *     controllers: [UserController],
 *     exports: ['UserService'],
 *   }
 *   // No register() needed - providers/controllers are auto-registered!
 * }
 *
 * @example
 * // Provider with dependencies using array-based inject
 * class DatabaseService {
 *   static readonly inject = [ConfigService] as const;
 *   constructor(
 *     private config: ConfigService,
 *   ) {}
 * }
 *
 * @example
 * // Module with custom registration (e.g., for dependencies)
 * class ServerModule extends Module {
 *   static readonly metadata: ModuleMetadata = {
 *     providers: [ConfigService],
 *   }
 *
 *   override register(container: ContainerInterface): void {
 *     super.register(container) // Auto-registers ConfigService
 *     // Custom registration for services with dependencies
 *     container.register(ServerService, (c) => {
 *       const config = c.resolve(ConfigService);
 *       return new ServerService(config);
 *     })
 *   }
 * }
 */
export abstract class Module implements OnModuleInit, OnModuleDestroy {
  static readonly metadata?: ModuleMetadata;

  /**
   * Register this module's providers with the container
   *
   * This default implementation auto-registers all providers and controllers
   * from the module's metadata. Override this method to add custom registration
   * logic or configure bindings with specific scopes.
   *
   * @param container - The container to register providers with
   */
  register(container: ContainerInterface): void {
    const ctor = this.constructor as typeof Module;
    const metadata = ctor.metadata;

    if (!metadata) {
      return;
    }

    // Auto-register providers from metadata
    if (metadata.providers) {
      for (const provider of metadata.providers) {
        // Register provider with the class itself as the token
        const ProviderClass = provider as new (...args: unknown[]) => unknown;
        container.register(ProviderClass, (c) => this.createInstance(ProviderClass, c));
      }
    }

    // Auto-register controllers from metadata
    if (metadata.controllers) {
      for (const controller of metadata.controllers) {
        // Register controller with the class itself as the token
        const ControllerClass = controller as new (...args: unknown[]) => unknown;
        container.register(ControllerClass, (c) => this.createInstance(ControllerClass, c));
      }
    }
  }

  /**
   * Creates an instance of a class using the array-based inject pattern.
   *
   * Classes declare dependencies via `static inject = [Dep1, Dep2] as const`
   * and receive them as individual constructor parameters.
   *
   * @param Class - The class constructor
   * @param container - The container to resolve dependencies from
   * @returns A new instance of the class
   */
  // oxlint-disable-next-line typescript-eslint(no-explicit-any)
  protected createInstance<TClass extends new (...args: any) => any>(
    Class: TClass,
    container: ResolverInterface,
  ): InstanceType<TClass> {
    const ClassWithInject = Class as typeof Class & {
      inject?: readonly unknown[];
    };

    // Check if class has an inject property
    if ('inject' in ClassWithInject && ClassWithInject.inject && Array.isArray(ClassWithInject.inject)) {
      const deps = container.buildDeps(ClassWithInject.inject as readonly Token[]);
      return new Class(...(deps as unknown[]));
    }

    // No inject property - instantiate without arguments
    return new Class();
  }

  /**
   * Get the tokens that this module exports
   *
   * Only exported tokens are visible to modules that import this module.
   *
   * @returns Array of tokens that this module exports
   */
  getExportedTokens(): Token[] {
    const ctor = this.constructor as typeof Module;
    return ctor.metadata?.exports ? [...ctor.metadata.exports] : [];
  }

  /**
   * Lifecycle hook: Called after the module is initialized
   *
   * Override this method to run setup logic when the module loads.
   *
   * @example
   * async onModuleInit() {
   *   await this.connectToDatabase()
   * }
   */
  onModuleInit(): Promise<void> | void {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: Called before the module is destroyed
   *
   * Override this method to run cleanup logic when the module unloads.
   *
   * @example
   * async onModuleDestroy() {
   *   await this.closeConnections()
   * }
   */
  onModuleDestroy(): Promise<void> | void {
    // Default implementation does nothing
  }
}
