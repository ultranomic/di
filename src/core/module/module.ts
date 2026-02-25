import type { ContainerInterface } from '../container/interfaces.ts';
import type { ModuleMetadata, OnModuleDestroy, OnModuleInit } from '../types/module.ts';
import type { Token } from '../types/token.ts';

export type { ModuleMetadata } from '../types/module.ts';

/**
 * Abstract base class for DI modules
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
 *     exports: [UserService],
 *   }
 *   // No register() needed - providers/controllers are auto-registered!
 * }
 *
 * @example
 * // Provider with dependencies using array-based inject
 * class DatabaseService {
 *   static readonly inject = [ConfigService] as const satisfies DepsTokens<DatabaseService>;
 *   constructor(
 *     private config: ConfigService,
 *   ) {}
 * }
 */
export abstract class Module implements OnModuleInit, OnModuleDestroy {
  static readonly metadata?: ModuleMetadata;

  /**
   * Register this module's providers with the container
   *
   * This default implementation auto-registers all providers and controllers
   * from the module's metadata. The container handles auto-instantiation
   * using the class's static inject property.
   *
   * @param container - The container to register providers with
   */
  register(container: ContainerInterface): void {
    const ctor = this.constructor as typeof Module;
    const metadata = ctor.metadata;

    if (metadata === undefined) {
      return;
    }

    // Auto-register providers from metadata
    if (metadata.providers !== undefined) {
      for (const provider of metadata.providers) {
        container.register(provider as Token);
      }
    }

    // Auto-register controllers from metadata
    if (metadata.controllers !== undefined) {
      for (const controller of metadata.controllers) {
        container.register(controller as Token);
      }
    }
  }

  /**
   * Get the tokens that this module exports
   *
   * Only exported tokens are visible to modules that import this module.
   *
   * @returns Array of tokens that this module exports
   */
  getExportedTokens(): Token[] {
    const exports = (this.constructor as typeof Module).metadata?.exports;
    return exports ? [...exports] : [];
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
