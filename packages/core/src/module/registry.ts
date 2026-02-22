/**
 * Module Registry for managing module loading and import resolution
 *
 * The registry handles:
 * - Tracking which modules have been loaded
 * - Resolving import dependencies
 * - Loading modules in the correct order (imports first)
 * - Calling lifecycle hooks (onModuleInit, onModuleDestroy)
 */

import type { ContainerInterface } from '../container/interfaces.js'
import type { ModuleConstructor, ModuleInterface } from './interfaces.js'

/**
 * ModuleRegistry orchestrates module loading with proper import resolution
 *
 * @example
 * const registry = new ModuleRegistry()
 * registry.register(UserModule)
 * registry.register(DatabaseModule)
 * await registry.loadModules(container)
 */
export class ModuleRegistry {
  private readonly modules = new Set<ModuleConstructor>()
  private readonly loadedModuleConstructors = new Set<ModuleConstructor>()
  private readonly loadedModuleInstances: ModuleInterface[] = []

  /**
   * Register a module to be loaded
   *
   * @param module - The module constructor to register
   */
  register(module: ModuleConstructor): void {
    this.modules.add(module)
  }

  /**
   * Load all registered modules into the container
   *
   * Modules are loaded in dependency order - imports are processed first.
   * After registration, onModuleInit() is called on each module.
   *
   * @param container - The container to register providers with
   */
  async loadModules(container: ContainerInterface): Promise<void> {
    for (const module of this.modules) {
      await this.loadModule(module, container)
    }
  }

  /**
   * Load a single module with its imports
   *
   * This method:
   * 1. Checks if the module is already loaded (prevents duplicates)
   * 2. Recursively loads imported modules first
   * 3. Instantiates and registers the module
   * 4. Calls onModuleInit() after registration
   *
   * @param module - The module constructor to load
   * @param container - The container to register providers with
   */
  async loadModule(module: ModuleConstructor, container: ContainerInterface): Promise<void> {
    if (this.loadedModuleConstructors.has(module)) {
      return
    }

    // Mark loaded before processing imports to prevent infinite recursion
    this.loadedModuleConstructors.add(module)

    const imports = module.metadata?.imports
    if (imports) {
      for (const importedModule of imports) {
        await this.loadModule(importedModule as ModuleConstructor, container)
      }
    }

    const instance = new module()
    instance.register(container)

    // Store instance for lifecycle management
    this.loadedModuleInstances.push(instance)

    // Call onModuleInit after registration
    if (instance.onModuleInit) {
      await instance.onModuleInit()
    }
  }

  /**
   * Destroy all loaded modules
   *
   * Calls onModuleDestroy() on each module in reverse order of loading.
   *
   */
  async destroyModules(): Promise<void> {
    // Destroy in reverse order (last loaded first)
    for (let i = this.loadedModuleInstances.length - 1; i >= 0; i--) {
      const instance = this.loadedModuleInstances[i]
      if (instance && instance.onModuleDestroy) {
        await instance.onModuleDestroy()
      }
    }
  }

  /**
   * Check if a module has been loaded
   *
   * @param module - The module constructor to check
   * @returns true if the module has been loaded
   */
  isLoaded(module: ModuleConstructor): boolean {
    return this.loadedModuleConstructors.has(module)
  }

  /**
   * Clear all registered and loaded modules
   *
   * Calls destroyModules() first to ensure proper cleanup.
   * Useful for testing.
   */
  async clear(): Promise<void> {
    await this.destroyModules()
    this.modules.clear()
    this.loadedModuleConstructors.clear()
    this.loadedModuleInstances.length = 0
  }
}
