import { defineInjectableFactory, type Injectable } from './define-injectable-factory.ts';

/**
 * Type alias for service components built on the Injectable foundation.
 * Services represent the business logic and data access layer of the application.
 *
 * @template T - The type of the service component
 * @example
 * ```typescript
 * type UserService = Service<{
 *   getUser: (id: string) => Promise<User>;
 *   createUser: (data: CreateUserData) => Promise<User>;
 * }>;
 * ```
 */
export type Service<T = unknown> = Injectable<T>;

/**
 * Main interface for the defineService utility.
 * Builds on defineInjectable with service-specific constraints and semantics.
 */
type DefineServiceFactory = {
  /**
   * Creates a service without dependencies.
   * Services must return object or void types (no primitive types).
   *
   * @template S - The return type of the service (must be object or void)
   * @param fn - Factory function that returns the service implementation
   * @returns A factory function that creates the service instance
   */
  handler<S extends object | void>(fn: () => S): () => Service<S>;

  /**
   * Creates a builder for services that require dependencies.
   *
   * @template T - Record type defining the required injectable dependencies
   * @returns A ServiceBuilder instance for configuring the service
   */
  inject<T extends Record<string, Injectable<unknown>>>(): ServiceFactoryBuilder<T>;
};

/**
 * Builder interface for creating services with dependencies.
 * Services can depend on any injectable components and have access to lifecycle hooks.
 *
 * @template T - Record type defining the required dependencies
 */
type ServiceFactoryBuilder<T> = {
  /**
   * Defines the handler function for the service with dependencies.
   *
   * @template S - The return type of the service (must be object or void)
   * @param fn - Factory function that receives injector and lifecycle hooks
   * @param fn.injector - Function that provides access to injected dependencies
   * @param fn.appHooks - Object containing application lifecycle hook registrars
   * @param fn.appHooks.onApplicationInitialized - Register callback for application initialization event
   * @param fn.appHooks.onApplicationStart - Register callback for application start event
   * @param fn.appHooks.onApplicationStop - Register callback for application stop event
   * @returns A factory function that accepts an injector and creates the service
   */
  handler<S extends object | void>(
    fn: (
      injector: () => T,
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      },
    ) => S,
  ): (injector: () => T) => Service<S>;
};

/**
 * Utility for creating type-safe service components with dependency injection support.
 * Services represent the business logic and data access layer of your application.
 *
 * Services are ideal for:
 * - Business logic implementation
 * - Data access and persistence
 * - External API integration
 * - Domain-specific operations
 * - Stateful components that need lifecycle management
 *
 * Key characteristics:
 * - Must return object or void types (enforced by type system)
 * - Can depend on other injectable components
 * - Have access to application lifecycle hooks
 * - Support both synchronous and asynchronous operations
 *
 * @example
 * ```typescript
 * // Simple service without dependencies
 * const mathService = defineService.handler(() => ({
 *   add: (a: number, b: number) => a + b,
 *   multiply: (a: number, b: number) => a * b
 * }));
 *
 * // Service with dependencies and lifecycle management
 * type Dependencies = {
 *   database: Service<{ query: (sql: string) => Promise<any[]> }>;
 *   logger: Service<{ log: (message: string) => void }>;
 * };
 *
 * const userService = defineService
 *   .inject<Dependencies>()
 *   .handler((injector, { onApplicationInitialized, onApplicationStart, onApplicationStop }) => {
 *     const { database, logger } = injector();
 *
 *     onApplicationInitialized(() => {
 *       logger.log('User service initialized during app creation');
 *     });
 *
 *     onApplicationStart(() => {
 *       logger.log('User service started');
 *     });
 *
 *     onApplicationStop(() => {
 *       logger.log('User service shutting down');
 *     });
 *
 *     return {
 *       async getUser(id: string) {
 *         logger.log(`Fetching user ${id}`);
 *         const results = await database.query(`SELECT * FROM users WHERE id = ?`, [id]);
 *         return results[0] || null;
 *       },
 *
 *       async createUser(userData: { name: string; email: string }) {
 *         logger.log(`Creating user ${userData.email}`);
 *         await database.query(`INSERT INTO users (name, email) VALUES (?, ?)`, [userData.name, userData.email]);
 *         return { id: crypto.randomUUID(), ...userData };
 *       }
 *     };
 *   });
 * ```
 */
export const defineServiceFactory: DefineServiceFactory = {
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
