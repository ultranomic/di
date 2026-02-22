import type { Token } from '../types/token.js'
import type { ContainerInterface } from '../container/interfaces.js'
import type { OnModuleInit, OnModuleDestroy } from '../types/module.js'

export interface ModuleMetadata {
  imports?: readonly unknown[]
  providers?: readonly unknown[]
  controllers?: readonly unknown[]
  exports?: readonly Token[]
}

/**
 * Abstract base class for Voxel modules
 *
 * Modules encapsulate providers, controllers, and imports to create
 * a cohesive unit of functionality.
 *
 * @example
 * class UserModule extends Module {
 *   static readonly metadata: ModuleMetadata = {
 *     imports: [DatabaseModule],
 *     providers: [UserService],
 *     exports: ['UserService'],
 *   }
 *
 *   register(container: ContainerInterface) {
 *     container.register('UserService', () => new UserService())
 *   }
 * }
 */
export abstract class Module implements OnModuleInit, OnModuleDestroy {
  static readonly metadata?: ModuleMetadata

  /**
   * Register this module's providers with the container
   *
   * @param container - The container to register providers with
   */
  abstract register(container: ContainerInterface): void

  /**
   * Get the tokens that this module exports
   *
   * Only exported tokens are visible to modules that import this module.
   *
   * @returns Array of tokens that this module exports
   */
  getExportedTokens(): Token[] {
    const ctor = this.constructor as typeof Module
    return ctor.metadata?.exports ? [...ctor.metadata.exports] : []
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
  async onModuleInit(): Promise<void> {
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
  async onModuleDestroy(): Promise<void> {
    // Default implementation does nothing
  }
}
