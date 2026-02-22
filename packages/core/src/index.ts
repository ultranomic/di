// Voxel Core - Dependency Injection Framework
// Export everything from subdirectories when implemented

// Types
export type { Token, TokenRegistry } from './types/token.js'
export type { InferDeps, Deps } from './types/deps.js'
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