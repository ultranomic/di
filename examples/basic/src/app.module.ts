import { Module } from '@voxeljs/core';
import type { ModuleMetadata } from '@voxeljs/core';
import { UserModule } from './user/user.module.js';

/**
 * Root application module
 *
 * This module demonstrates:
 * 1. Using ModuleRegistry for import resolution (no manual instantiation)
 * 2. Defining imports in metadata for ModuleRegistry to process
 * 3. Lifecycle hooks (onModuleInit, onModuleDestroy)
 */
export class AppModule extends Module {
  static readonly metadata: ModuleMetadata = {
    imports: [UserModule],
  };

  register(container: import('@voxeljs/core').ContainerInterface): void {
    // ModuleRegistry automatically loads UserModule before calling this
    // No need to manually: new UserModule(); userModule.register(container);
    // The registry handles instantiation, registration, and lifecycle hooks
  }

  /**
   * Lifecycle hook - called after all modules are loaded
   * Demonstrates module initialization pattern
   */
  override async onModuleInit(): Promise<void> {
    console.log('AppModule initialized');
  }

  /**
   * Lifecycle hook - called before module destruction
   * Demonstrates cleanup pattern
   */
  override async onModuleDestroy(): Promise<void> {
    console.log('AppModule destroyed');
  }
}
