/**
 * @fileoverview Main entry point for the @ultranomic/di dependency injection framework.
 *
 * This module exports all the core utilities for building type-safe, modular applications
 * with dependency injection and comprehensive lifecycle management.
 *
 * Architecture layers (bottom to top):
 * 1. Injectable - Core dependency injection foundation
 * 2. Service - Business logic and data access layer
 * 3. Module - Feature organization and grouping layer
 * 4. Router - HTTP endpoint definitions and routing logic
 * 5. App - Application lifecycle orchestration
 *
 * @example
 * ```typescript
 * import { defineServiceFactory, defineModuleFactory, defineRouterFactory, defineApp } from '@ultranomic/di';
 *
 * // Create a service factory
 * const defineUserService = defineServiceFactory.handler(() => ({
 *   getUser: (id: string) => ({ id, name: `User ${id}` })
 * }));
 *
 * // Create a module factory that uses the service
 * const defineUserModule = defineModuleFactory
 *   .inject<{ userService: typeof defineUserService }>()
 *   .handler((injector) => {
 *     const { userService } = injector();
 *     return {
 *       getUserProfile: (id: string) => userService.getUser(id)
 *     };
 *   });
 *
 * // Create a router factory that uses the module
 * const defineUserRouter = defineRouterFactory
 *   .inject<{ userModule: typeof defineUserModule }>()
 *   .handler((injector) => {
 *     const { userModule } = injector();
 *     return {
 *       '/api/users/:id': {
 *         GET: ({ params }: { params: { id: string } }) => {
 *           return userModule.getUserProfile(params.id);
 *         }
 *       }
 *     };
 *   });
 *
 * // Create the main app module factory
 * const defineAppModule = defineModuleFactory.handler(() => ({
 *   name: 'My App',
 *   version: '1.0.0',
 *   userRouter: defineUserRouter()
 * }));
 *
 * // Create the application instance
 * const app = await defineApp(defineAppModule);
 *
 * await app.start();
 * ```
 */

// Application layer - Top-level orchestration and lifecycle management
export * from './define-app.ts';

// Base layer - Core dependency injection foundation
export * from './define-injectable-factory.ts';

// Feature organization layer - Grouping and module boundaries
export * from './define-module-factory.ts';

// HTTP routing layer - Endpoint definitions and request handling
export * from './define-router-factory.ts';

// Business logic layer - Services and data access
export * from './define-service-factory.ts';
