/**
 * Module type definitions for the Voxel DI system
 *
 * Modules encapsulate providers, controllers, and imports to create
 * a cohesive unit of functionality.
 */

import type { Token } from './token.js'

/**
 * Lifecycle hook: Called when a module is initialized
 *
 * Implement this interface to run setup logic when the module loads.
 *
 * @example
 * class DatabaseService implements OnModuleInit {
 *   async onModuleInit() {
 *     await this.connect()
 *   }
 * }
 */
export interface OnModuleInit {
  /** Called after the module is initialized */
  onModuleInit(): Promise<void> | void
}

/**
 * Lifecycle hook: Called when a module is destroyed
 *
 * Implement this interface to run cleanup logic when the module unloads.
 *
 * @example
 * class DatabaseService implements OnModuleDestroy {
 *   async onModuleDestroy() {
 *     await this.disconnect()
 *   }
 * }
 */
export interface OnModuleDestroy {
  /** Called before the module is destroyed */
  onModuleDestroy(): Promise<void> | void
}

/**
 * Module configuration interface
 *
 * Defines the structure of a Voxel module with its imports, providers,
 * controllers, and exports.
 *
 * @example
 * class UserModule {
 *   static readonly imports = [DatabaseModule, LoggerModule]
 *   static readonly providers = [UserService, UserRepository]
 *   static readonly controllers = [UserController]
 *   static readonly exports = [UserService]
 * }
 */
export interface ModuleConfig {
  /**
   * Modules whose exported providers are available to this module
   * @readonly
   */
  imports?: readonly unknown[]

  /**
   * Service providers registered in this module
   * @readonly
   */
  providers?: readonly unknown[]

  /**
   * Controllers (HTTP route handlers) registered in this module
   * @readonly
   */
  controllers?: readonly unknown[]

  /**
   * Tokens that should be visible to modules importing this one
   * Only exported providers are accessible to importing modules.
   * @readonly
   */
  exports?: readonly Token[]
}

/**
 * Module class type constraint
 *
 * A type that ensures a class has a valid module configuration.
 *
 * @template T - The module configuration type
 */
export type ModuleClass<T extends ModuleConfig = ModuleConfig> = {
  [K in keyof T]: T[K]
} & {
  new (...args: unknown[]): unknown
}
