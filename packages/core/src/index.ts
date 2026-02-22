// Voxel Core - Dependency Injection Framework
// Export everything from subdirectories when implemented

// Types
export type { Token, TokenRegistry } from './types/token.js'
export type { InferDeps, Deps, InjectableClass, ExtractInject } from './types/deps.js'
export type {
  BaseRequest,
  BaseResponse,
  HttpMethod,
  ExtractPathParams,
  ControllerRoute,
  TypedRequest,
  TypedResponse,
} from './types/controller.js'
export type {
  ModuleConfig,
  ModuleClass,
  OnModuleInit,
  OnModuleDestroy,
} from './types/module.js'


// Container
export { Container } from './container/container.js'
export { BindingScope, BindingBuilder } from './container/binding.js'
export type { Binding, ContainerLike } from './container/binding.js'
export type { ContainerInterface, ResolverInterface } from './container/interfaces.js'

// Module
export { Module } from './module/module.js'
export type { ModuleMetadata } from './module/module.js'
export type { ModuleInterface, ModuleConstructor } from './module/interfaces.js'
export { ModuleRegistry } from './module/registry.js'

// Controller
export { Controller } from './controller/controller.js'
export type { ControllerMetadata } from './controller/controller.js'
export type { ControllerConstructor, RouteInfo } from './controller/interfaces.js'

// Errors
export { VoxelError, TokenNotFoundError, ScopeValidationError } from './errors/index.js'
