import { Module } from '@voxeljs/core';
import type { ModuleMetadata } from '@voxeljs/core';
import { UserModule } from './user/user.module.js';

export class AppModule extends Module {
  static readonly metadata: ModuleMetadata = {
    imports: [UserModule],
  };

  register(container: import('@voxeljs/core').ContainerInterface): void {
    const userModule = new UserModule();
    userModule.register(container);
  }
}
