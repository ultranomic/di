/**
 * Module Registry for managing module loading and import resolution
 *
 * The registry handles:
 * - Tracking which modules have been loaded
 * - Resolving import dependencies
 * - Loading modules in the correct order (imports first)
 * - Calling lifecycle hooks (onModuleInit, onModuleDestroy)
 * - Enforcing module encapsulation by tracking token ownership
 */

import type { ContainerInterface } from '../container/interfaces.ts';
import type { Token } from '../types/token.ts';
import type { ModuleConstructor, ModuleInterface } from './interfaces.ts';
import { ModuleContainer } from './module-container.ts';

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
  private readonly modules = new Set<ModuleConstructor>();
  private readonly loadedModuleConstructors = new Set<ModuleConstructor>();
  private readonly loadedModuleInstances: ModuleInterface[] = [];
  private readonly tokenOwners = new Map<Token, { module: string; isExported: boolean }>();
  private readonly moduleContainers = new Map<string, ModuleContainer>();

  /**
   * Register a module to be loaded
   *
   * @param module - The module constructor to register
   */
  register(module: ModuleConstructor): void {
    this.modules.add(module);
  }

  /**
   * Load all registered modules into the container
   *
   * Modules are loaded in dependency order - imports are processed first.
   * After registration, onModuleInit() is called on each module.
   * Finally, dependencies are validated to enforce encapsulation.
   *
   * @param container - The container to register providers with
   */
  async loadModules(container: ContainerInterface): Promise<void> {
    for (const module of this.modules) {
      await this.loadModule(module, container);
    }

    // Validate all dependencies to enforce encapsulation
    // This catches errors at bootstrap time rather than resolution time
    await this.validateDependencies();
  }

  /**
   * Validate dependencies for all loaded modules
   *
   * This resolves each token once to ensure encapsulation rules are respected.
   * Errors are thrown at bootstrap time for better developer experience.
   */
  private async validateDependencies(): Promise<void> {
    for (const [token, owner] of this.tokenOwners) {
      const moduleContainer = this.moduleContainers.get(owner.module);
      if (moduleContainer !== undefined) {
        try {
          moduleContainer.resolve(token);
        } catch (error) {
          // Re-throw encapsulation errors, ignore others (e.g., TokenNotFoundError)
          if (error instanceof Error && error.name === 'NonExportedTokenError') {
            throw error;
          }
        }
      }
    }
  }

  /**
   * Load a single module with its imports
   *
   * This method:
   * 1. Checks if the module is already loaded (prevents duplicates)
   * 2. Recursively loads imported modules first
   * 3. Creates a module-aware container for encapsulation
   * 4. Instantiates and registers the module
   * 5. Calls onModuleInit() after registration
   *
   * @param module - The module constructor to load
   * @param container - The container to register providers with
   * @param parentModule - The module that is importing this module (if any)
   */
  async loadModule(
    module: ModuleConstructor,
    container: ContainerInterface,
    parentModule?: ModuleConstructor,
  ): Promise<void> {
    if (this.loadedModuleConstructors.has(module)) {
      return;
    }

    // Mark loaded before processing imports to prevent infinite recursion
    this.loadedModuleConstructors.add(module);

    const moduleName = this.getModuleName(module);
    const exports = module.metadata?.exports ?? [];

    // Create a module-aware container for encapsulation
    const moduleContainer = new ModuleContainer(container, moduleName, exports, this.tokenOwners);
    this.moduleContainers.set(moduleName, moduleContainer);

    // Track parent relationship for encapsulation
    if (parentModule !== undefined) {
      moduleContainer.addAccessibleModule(this.getModuleName(parentModule));
    }

    // Load imports first (recursive)
    const imports = module.metadata?.imports;
    if (imports !== undefined) {
      for (const importedModule of imports) {
        await this.loadModule(importedModule as ModuleConstructor, container, module);
        moduleContainer.addAccessibleModule(this.getModuleName(importedModule as ModuleConstructor));
      }
    }

    // Instantiate and register the module
    const instance = new module();
    instance.register(moduleContainer);
    this.loadedModuleInstances.push(instance);

    // Call lifecycle hook
    if (instance.onModuleInit !== undefined) {
      await instance.onModuleInit();
    }
  }

  /**
   * Get a human-readable name for a module
   */
  private getModuleName(module: ModuleConstructor): string {
    return module.name !== undefined && module.name.length > 0 ? module.name : 'AnonymousModule';
  }

  /**
   * Destroy all loaded modules
   *
   * Calls onModuleDestroy() on each module in reverse order of loading.
   */
  async destroyModules(): Promise<void> {
    for (let i = this.loadedModuleInstances.length - 1; i >= 0; i--) {
      const instance = this.loadedModuleInstances[i];
      if (instance !== undefined && instance.onModuleDestroy !== undefined) {
        await instance.onModuleDestroy();
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
    return this.loadedModuleConstructors.has(module);
  }

  /**
   * Clear all registered and loaded modules
   *
   * Calls destroyModules() first to ensure proper cleanup.
   * Useful for testing.
   */
  async clear(): Promise<void> {
    await this.destroyModules();
    this.modules.clear();
    this.loadedModuleConstructors.clear();
    this.loadedModuleInstances.length = 0;
    this.tokenOwners.clear();
    this.moduleContainers.clear();
  }
}
