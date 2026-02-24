import type { ContainerInterface, ModuleMetadata, Token } from '@voxeljs/core';
import { Module } from '@voxeljs/core';
import { UserController } from './user.controller.ts';
import { UserService } from './user.service.ts';

/**
 * User Module
 *
 * This module demonstrates:
 * 1. Encapsulation - only exports UserService (not UserController)
 * 2. Provider registration pattern
 * 3. Controller registration pattern
 */
export class UserModule extends Module {
  static readonly metadata: ModuleMetadata = {
    providers: [UserService],
    controllers: [UserController],
    // Only export UserService - UserController is internal to this module
    exports: ['UserService'],
  };

  /**
   * Register this module's providers with the container
   *
   * TODO: Once auto-registration (task #2) is complete, this method
   * can be removed as ModuleRegistry will auto-register from metadata.
   */
  register(container: ContainerInterface): void {
    // Register UserService with singleton scope
    container
      .register('UserService', (c) => {
        return new UserService(...(c.buildDeps(UserService.inject) as unknown as []));
      })
      .asSingleton();

    // Register UserController - scoped per request
    // Use type assertion because UserController has a typed constructor signature
    const UserControllerToken = UserController as Token;
    container.register(UserControllerToken, (c) => {
      return new UserController(...(c.buildDeps(UserController.inject) as unknown as [UserService]));
    });
  }

  /**
   * Lifecycle hook - demonstrates module initialization
   */
  override async onModuleInit(): Promise<void> {
    console.log('UserModule initialized with UserService exported');
  }

  /**
   * Lifecycle hook - demonstrates cleanup
   */
  override async onModuleDestroy(): Promise<void> {
    console.log('UserModule destroyed');
  }
}
