/**
 * Module interface definitions for the Voxel DI system
 *
 * These types provide the public API for module definitions.
 */

import type { ContainerInterface } from '../container/interfaces.ts';
import type { ModuleMetadata } from '../types/module.ts';

/**
 * ModuleInterface defines the contract for module instances
 *
 * This is the type-only interface that describes what a module instance
 * should provide at runtime.
 *
 * @example
 * function registerModule(module: ModuleInterface) {
 *   module.register(container)
 * }
 */
export interface ModuleInterface {
  /**
   * Register this module's providers with the container
   *
   * @param container - The container to register providers with
   */
  register(container: ContainerInterface): void;

  /**
   * Lifecycle hook: Called after the module is initialized
   */
  onModuleInit?(): Promise<void> | void;

  /**
   * Lifecycle hook: Called before the module is destroyed
   */
  onModuleDestroy?(): Promise<void> | void;
}

/**
 * ModuleConstructor defines the type for module classes
 *
 * This type ensures that module classes have the required static metadata
 * and can be instantiated to create module instances.
 *
 * @example
 * const ModuleClass: ModuleConstructor = DatabaseModule
 * const instance = new ModuleClass()
 * instance.register(container)
 */
export interface ModuleConstructor {
  /**
   * Creates a new module instance
   */
  new (): ModuleInterface;

  /**
   * Static metadata describing the module's configuration
   */
  readonly metadata?: ModuleMetadata;
}
