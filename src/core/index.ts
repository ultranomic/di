// Core - Dependency Injection Framework
// Export everything from subdirectories when implemented

// Types
export type {
  BaseRequest,
  BaseResponse,
  ControllerRoute,
  ExtractPathParams,
  HttpMethod,
  TypedRequest,
  TypedResponse,
} from './types/controller.ts';
export type {
  DependencyTokens,
  InferInjectedInstanceTypes,
} from './types/dependencies.ts';
export type { ModuleMetadata, OnModuleDestroy, OnModuleInit } from './types/module.ts';

// Injectable base class
export { Injectable, type InjectableConstructor } from './types/injectable.ts';

// Container
export { Scope } from './container/binding.ts';
export type { Binding, ContainerLike, RegisterOptions } from './container/binding.ts';
export { Container } from './container/container.ts';
export type { ContainerInterface, ResolverInterface } from './container/interfaces.ts';

// Module
export type { ModuleConstructor, ModuleInterface } from './module/interfaces.ts';
export { Module } from './module/module.ts';
export { ModuleRegistry } from './module/registry.ts';

// Controller
export { Controller } from './controller/controller.ts';
export type { ControllerMetadata } from './controller/controller.ts';
export type { ControllerConstructor, RouteInfo } from './controller/interfaces.ts';

// Errors
export {
  CircularDependencyError,
  DependencyInjectionError,
  NonExportedTokenError,
  ScopeValidationError,
  TokenCollisionError,
  TokenNotFoundError,
} from './errors/index.ts';

// Utils
export { joinPath } from './utils/path.ts';
