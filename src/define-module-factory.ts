import { defineInjectableFactory, type Injectable } from './define-injectable-factory.ts';

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
 * Main interface for the defineModuleFactory utility.
 * Builds on defineInjectableFactory with module-specific constraints for feature organization.
 */
type DefineModuleFactory = {
  /**
   * Creates a module factory function without dependencies.
   * Modules must return Record types with string or symbol keys, or void.
   *
   * @template S - The return type of the module (must be Record<string | symbol, unknown> or void)
   * @param fn - Factory function that returns the module implementation
   * @returns A factory function that creates the module instance
   */
  handler<S extends Record<string | symbol, unknown> | void>(fn: () => S): () => Module<S>;

  /**
   * Creates a builder for module factory functions that require dependencies.
   *
   * @template T - Record type defining the required injectable dependencies
   * @returns A ModuleFactoryBuilder instance for configuring the module factory
   */
  inject<T extends Record<string, Injectable<unknown>>>(): ModuleFactoryBuilder<T>;
};

/**
 * Builder interface for creating module factory functions with dependencies.
 * Modules can depend on any injectable components (services, other modules, etc.).
 *
 * @template T - Record type defining the required dependencies
 */
type ModuleFactoryBuilder<T> = {
  /**
   * Defines the handler function for the module with dependencies.
   *
   * @template S - The return type of the module (must be Record<string | symbol, unknown> or void)
   * @param fn - Factory function that receives injector and lifecycle hooks
   * @param fn.injector - Function that provides access to injected dependencies
   * @param fn.appHooks - Object containing application lifecycle hook registrars
   * @param fn.appHooks.onApplicationInitialized - Register callback for application initialization event
   * @param fn.appHooks.onApplicationStart - Register callback for application start event
   * @param fn.appHooks.onApplicationStop - Register callback for application stop event
   * @returns A factory function that accepts an injector and creates the module
   */
  handler<S extends Record<string | symbol, unknown> | void>(
    fn: (
      injector: () => T,
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      },
    ) => S,
  ): (injector: () => T) => Module<S>;
};

/**
 * Utility for creating type-safe module factory functions that organize related functionality.
 * Module factories serve as feature boundaries and help structure large applications into manageable units.
 *
 * Module factories are ideal for:
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
 * // Simple feature module factory without dependencies
 * const defineUserModule = defineModuleFactory.handler(() => ({
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
 * // Complex module factory with dependencies and lifecycle management
 * type Dependencies = {
 *   userService: Service<{ getUser: (id: string) => Promise<User> }>;
 *   authService: Service<{ validateToken: (token: string) => boolean }>;
 *   logger: Service<{ log: (message: string) => void }>;
 * };
 *
 * const defineUserModule = defineModuleFactory
 *   .inject<Dependencies>()
 *   .handler((injector, { onApplicationInitialized, onApplicationStart }) => {
 *     const { userService, authService, logger } = injector();
 *
 *     onApplicationInitialized(() => {
 *       logger.log('User module initialized during app creation');
 *     });
 *
 *     onApplicationStart(() => {
 *       logger.log('User module started');
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
export const defineModuleFactory: DefineModuleFactory = {
  handler: (fn) => () => defineInjectableFactory.handler(fn)(),
  inject: () => ({
    handler: (fn) => {
      return (injector) => {
        const injectable = defineInjectableFactory.inject().handler(fn as any)(injector);
        return injectable as any;
      };
    },
  }),
};
