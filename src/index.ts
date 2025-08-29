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
 * import { defineService, defineModule, defineRouter, defineApp } from '@ultranomic/di';
 * 
 * // Create a service
 * const userService = defineService.handler(() => ({
 *   getUser: (id: string) => ({ id, name: `User ${id}` })
 * }));
 * 
 * // Create a module that uses the service
 * const userModule = defineModule
 *   .inject<{ userService: typeof userService }>()
 *   .handler((injector) => {
 *     const { userService } = injector();
 *     return {
 *       getUserProfile: (id: string) => userService().getUser(id)
 *     };
 *   });
 * 
 * // Create a router that uses the module
 * const userRouter = defineRouter
 *   .inject<{ userModule: typeof userModule }>()
 *   .handler((injector) => {
 *     const { userModule } = injector();
 *     return {
 *       '/api/users/:id': {
 *         GET: ({ params }: { params: { id: string } }) => {
 *           return userModule().getUserProfile(params.id);
 *         }
 *       }
 *     };
 *   });
 * 
 * // Create the application
 * const app = await defineApp(() => ({
 *   name: 'My App',
 *   version: '1.0.0',
 *   router: userRouter
 * }));
 * 
 * await app.start();
 * ```
 */

// Application layer - Top-level orchestration and lifecycle management
export * from './define-app.ts';

// Base layer - Core dependency injection foundation
export * from './define-injectable.ts';

// Feature organization layer - Grouping and module boundaries
export * from './define-module.ts';

// HTTP routing layer - Endpoint definitions and request handling
export * from './define-router.ts';

// Business logic layer - Services and data access
export * from './define-service.ts';
