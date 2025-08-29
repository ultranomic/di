import { defineInjectable, type Injectable } from './define-injectable.ts';

/**
 * Type alias for module components built on the Injectable foundation.
 * Modules represent feature groupings and organizational units within the application.
 * 
 * @template T - The type of the module component
 * @example
 * ```typescript
 * type UserModule = Module<{
 *   userService: { getUser: (id: string) => User };
 *   userValidation: { validateEmail: (email: string) => boolean };
 *   userUtils: { formatUserName: (user: User) => string };
 * }>;
 * ```
 */
export type Module<T = unknown> = Injectable<T>;

/**
 * Main interface for the defineModule utility.
 * Builds on defineInjectable with module-specific constraints for feature organization.
 */
type DefineModule = {
  /**
   * Creates a module without dependencies.
   * Modules must return Record types with string or symbol keys, or void.
   * 
   * @template S - The return type of the module (must be Record<string | symbol, unknown> or void)
   * @param fn - Factory function that returns the module implementation
   * @returns A factory function that creates the module instance
   */
  handler<S extends Record<string | symbol, unknown> | void>(fn: () => S): () => Module<S>;

  /**
   * Creates a builder for modules that require dependencies.
   * 
   * @template T - Record type defining the required injectable dependencies
   * @returns A ModuleBuilder instance for configuring the module
   */
  inject<T extends Record<string, Injectable<unknown>>>(): ModuleBuilder<T>;
};

/**
 * Builder interface for creating modules with dependencies.
 * Modules can depend on any injectable components (services, other modules, etc.).
 * 
 * @template T - Record type defining the required dependencies
 */
type ModuleBuilder<T> = {
  /**
   * Defines the handler function for the module with dependencies.
   * 
   * @template S - The return type of the module (must be Record<string | symbol, unknown> or void)
   * @param fn - Factory function that receives injector and lifecycle hooks
   * @param fn.injector - Function that provides access to injected dependencies
   * @param fn.appHooks - Object containing application lifecycle hook registrars
   * @param fn.appHooks.onApplicationStart - Register callback for application start event
   * @param fn.appHooks.onApplicationStop - Register callback for application stop event
   * @returns A factory function that accepts an injector and creates the module
   */
  handler<S extends Record<string | symbol, unknown> | void>(
    fn: (
      injector: () => T,
      appHooks: {
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      },
    ) => S,
  ): (injector: () => T) => Module<S>;
};

/**
 * Utility for creating type-safe module components that organize related functionality.
 * Modules serve as feature boundaries and help structure large applications into manageable units.
 * 
 * Modules are ideal for:
 * - Feature organization and grouping
 * - Domain boundary definitions
 * - Aggregating related services and utilities
 * - Creating reusable feature packages
 * - Implementing cross-cutting concerns
 * 
 * Key characteristics:
 * - Must return Record types with string/symbol keys or void
 * - Can depend on services, other modules, and injectable components
 * - Support both public and private (symbol-keyed) exports
 * - Have access to application lifecycle hooks
 * - Enable composition and feature isolation
 * 
 * @example
 * ```typescript
 * // Simple feature module without dependencies
 * const mathModule = defineModule.handler(() => ({
 *   operations: {
 *     add: (a: number, b: number) => a + b,
 *     subtract: (a: number, b: number) => a - b
 *   },
 *   constants: {
 *     PI: Math.PI,
 *     E: Math.E
 *   }
 * }));
 * 
 * // Complex module with dependencies and lifecycle management
 * type Dependencies = {
 *   userService: Service<{ getUser: (id: string) => Promise<User> }>;
 *   authService: Service<{ validateToken: (token: string) => boolean }>;
 *   logger: Service<{ log: (message: string) => void }>;
 * };
 * 
 * const userModule = defineModule
 *   .inject<Dependencies>()
 *   .handler((injector, { onApplicationStart }) => {
 *     const { userService, authService, logger } = injector();
 *     
 *     onApplicationStart(() => {
 *       logger.log('User module initialized');
 *     });
 *     
 *     return {
 *       // Public API
 *       getUserProfile: async (userId: string, token: string) => {
 *         if (!authService.validateToken(token)) {
 *           throw new Error('Invalid token');
 *         }
 *         return userService.getUser(userId);
 *       },
 *       
 *       // Aggregated functionality
 *       userOperations: {
 *         authenticate: authService.validateToken,
 *         fetchUser: userService.getUser
 *       },
 *       
 *       // Module-specific utilities
 *       utils: {
 *         formatUserDisplayName: (user: User) => `${user.firstName} ${user.lastName}`,
 *         getUserInitials: (user: User) => `${user.firstName[0]}${user.lastName[0]}`
 *       }
 *     };
 *   });
 * ```
 */
export const defineModule: DefineModule = {
  handler: (fn) => () => defineInjectable.handler(fn)(),
  inject: () => ({
    handler: (fn) => {
      return (injector) => {
        const injectable = defineInjectable.inject().handler(fn as any)(injector);
        return injectable as any;
      };
    },
  }),
};
