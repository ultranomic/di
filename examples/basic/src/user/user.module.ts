import { Module } from '@voxeljs/core';
import type { ModuleMetadata, ContainerInterface } from '@voxeljs/core';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';

export class UserModule extends Module {
  static readonly metadata: ModuleMetadata = {
    providers: [UserService],
    controllers: [UserController],
    exports: ['UserService'],
  };

  register(container: ContainerInterface): void {
    container.register('UserService', (c) => {
      return new UserService(c.buildDeps(UserService.inject));
    }).asSingleton();

    container.register(UserController, (c) => {
      return new UserController({
        userService: c.resolve('UserService'),
      });
    });
  }
}
