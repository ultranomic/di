/**
 * Module Registry for managing module loading and import resolution
 *
 * The registry handles:
 * - Tracking which modules have been loaded
 * - Resolving import dependencies
 * - Loading modules in the correct order (imports first)
 */

import type { ContainerInterface } from '../container/interfaces.js'
import type { ModuleConstructor } from './interfaces.js'

/**
 * ModuleRegistry orchestrates module loading with proper import resolution
 *
 * @example
 * const registry = new ModuleRegistry()
 * registry.register(UserModule)
 * registry.register(DatabaseModule)
 * registry.loadModules(container)
 */
export class ModuleRegistry {
  private readonly modules = new Set<ModuleConstructor>()
  private readonly loadedModules = new Set<ModuleConstructor>()

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
   *
   * @param container - The container to register providers with
   */
  loadModules(container: ContainerInterface): void {
    for (const module of this.modules) {
      this.loadModule(module, container)
    }
  }

  /**
   * Load a single module with its imports
   *
   * This method:
   * 1. Checks if the module is already loaded (prevents duplicates)
   * 2. Recursively loads imported modules first
   * 3. Instantiates and registers the module
   *
   * @param module - The module constructor to load
   * @param container - The container to register providers with
   */
  loadModule(module: ModuleConstructor, container: ContainerInterface): void {
    if (this.loadedModules.has(module)) {
      return
    }

    // Mark loaded before processing imports to prevent infinite recursion
    this.loadedModules.add(module)

    const imports = module.metadata?.imports
    if (imports) {
      for (const importedModule of imports) {
        this.loadModule(importedModule as ModuleConstructor, container)
      }
    }

    const instance = new module()
    instance.register(container)
  }

  /**
   * Check if a module has been loaded
   *
   * @param module - The module constructor to check
   * @returns true if the module has been loaded
   */
  isLoaded(module: ModuleConstructor): boolean {
    return this.loadedModules.has(module)
  }

  /**
   * Clear all registered and loaded modules
   *
   * Useful for testing
   */
  clear(): void {
    this.modules.clear()
    this.loadedModules.clear()
  }
}
