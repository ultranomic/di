import { defineInjectableFactory, type Injectable } from './define-injectable-factory.ts';

/**
 * Type alias for router components built on the Injectable foundation.
 * Routers define HTTP endpoint handlers and API routing logic.
 *
 * @template T - The type of the router component
 * @example
 * ```typescript
 * type UserRouter = Router<{
 *   '/api/users': { GET: () => User[]; POST: (data: CreateUserData) => User };
 *   '/api/users/:id': { GET: (params: { id: string }) => User };
 * }>;
 * ```
 */
export type Router<T = unknown> = Injectable<T>;

/**
 * Main interface for the defineRouterFactory utility.
 * Builds on defineInjectableFactory with router-specific constraints for HTTP endpoint definitions.
 */
type DefineRouterFactory = {
  /**
   * Creates a router factory function without dependencies.
   * Routers must return Record types with string or symbol keys, or void.
   *
   * @template S - The return type of the router (must be Record<string | symbol, unknown> or void)
   * @param fn - Factory function that returns the router implementation
   * @returns A factory function that creates the router instance
   */
  handler<S extends Record<string | symbol, unknown> | void>(fn: () => S): () => Router<S>;

  /**
   * Creates a builder for router factory functions that require dependencies.
   *
   * @template T - Record type defining the required injectable dependencies
   * @returns A RouterFactoryBuilder instance for configuring the router factory
   */
  inject<T extends Record<string, Injectable<unknown>>>(): RouterFactoryBuilder<T>;
};

/**
 * Builder interface for creating router factory functions with dependencies.
 * Routers can depend on services, modules, middleware, and other injectable components.
 *
 * @template T - Record type defining the required dependencies
 */
type RouterFactoryBuilder<T> = {
  /**
   * Defines the handler function for the router with dependencies.
   *
   * @template S - The return type of the router (must be Record<string | symbol, unknown> or void)
   * @param fn - Factory function that receives injector and lifecycle hooks
   * @param fn.injector - Function that provides access to injected dependencies
   * @param fn.appHooks - Object containing application lifecycle hook registrars
   * @param fn.appHooks.onApplicationInitialized - Register callback for application initialization event
   * @param fn.appHooks.onApplicationStart - Register callback for application start event
   * @param fn.appHooks.onApplicationStop - Register callback for application stop event
   * @returns A factory function that accepts an injector and creates the router
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
  ): (injector: () => T) => Router<S>;
};

/**
 * Utility for creating type-safe router factory functions that define HTTP endpoints and API routing logic.
 * Router factories provide a generic foundation for organizing endpoint handlers and can be used with any HTTP framework.
 *
 * Router factories are ideal for:
 * - HTTP endpoint definitions
 * - API route handlers
 * - Request/response processing
 * - Authentication and authorization
 * - Middleware integration
 * - RESTful API design
 * - RPC endpoint definitions
 *
 * Key characteristics:
 * - Must return Record types with string/symbol keys or void
 * - Can depend on services, modules, middleware, and other injectable components
 * - Support parameterized routes (e.g., '/users/:id')
 * - Compatible with HTTP method definitions (GET, POST, PUT, DELETE, etc.)
 * - Have access to application lifecycle hooks
 * - Enable clean separation of routing logic from business logic
 *
 * @example
 * ```typescript
 * // Simple router factory without dependencies
 * const defineHealthRouter = defineRouterFactory.handler(() => ({
 *   '/health': {
 *     GET: () => ({ status: 'ok', timestamp: new Date().toISOString() })
 *   },
 *   '/version': {
 *     GET: () => ({ version: '1.0.0' })
 *   }
 * }));
 *
 * // Complex router factory with dependencies and full CRUD operations
 * type Dependencies = {
 *   userService: Service<{
 *     getUser: (id: string) => Promise<User>;
 *     createUser: (data: CreateUserData) => Promise<User>;
 *     updateUser: (id: string, data: Partial<User>) => Promise<User>;
 *     deleteUser: (id: string) => Promise<void>;
 *   }>;
 *   authMiddleware: Service<{
 *     authenticate: (token: string) => Promise<User | null>;
 *     authorize: (user: User, resource: string) => boolean;
 *   }>;
 *   logger: Service<{ log: (message: string) => void }>;
 * };
 *
 * const defineUserRouter = defineRouterFactory
 *   .inject<Dependencies>()
 *   .handler((injector, { onApplicationInitialized, onApplicationStart }) => {
 *     const { userService, authMiddleware, logger } = injector();
 *
 *     onApplicationInitialized(() => {
 *       logger.log('User router initialized during app creation');
 *     });
 *
 *     onApplicationStart(() => {
 *       logger.log('User router started');
 *     });
 *
 *     return {
 *       '/api/users': {
 *         GET: async ({ query, headers }: { query?: { limit?: string }; headers: { authorization?: string } }) => {
 *           const user = await authMiddleware.authenticate(headers.authorization || '');
 *           if (!user) return { error: 'Unauthorized', status: 401 };
 *
 *           const limit = query?.limit ? parseInt(query.limit) : 10;
 *           logger.log(`Fetching users, limit: ${limit}`);
 *           return { users: await userService.getUsers(limit) };
 *         },
 *
 *         POST: async ({ body, headers }: { body: CreateUserData; headers: { authorization?: string } }) => {
 *           const user = await authMiddleware.authenticate(headers.authorization || '');
 *           if (!user || !authMiddleware.authorize(user, 'users:create')) {
 *             return { error: 'Forbidden', status: 403 };
 *           }
 *
 *           logger.log(`Creating user: ${body.email}`);
 *           const newUser = await userService.createUser(body);
 *           return { user: newUser, status: 201 };
 *         }
 *       },
 *
 *       '/api/users/:id': {
 *         GET: async ({ params, headers }: { params: { id: string }; headers: { authorization?: string } }) => {
 *           const user = await authMiddleware.authenticate(headers.authorization || '');
 *           if (!user) return { error: 'Unauthorized', status: 401 };
 *
 *           const targetUser = await userService.getUser(params.id);
 *           return targetUser ? { user: targetUser } : { error: 'Not found', status: 404 };
 *         },
 *
 *         PUT: async ({ params, body, headers }: {
 *           params: { id: string };
 *           body: Partial<User>;
 *           headers: { authorization?: string }
 *         }) => {
 *           const user = await authMiddleware.authenticate(headers.authorization || '');
 *           if (!user || !authMiddleware.authorize(user, 'users:update')) {
 *             return { error: 'Forbidden', status: 403 };
 *           }
 *
 *           const updatedUser = await userService.updateUser(params.id, body);
 *           return { user: updatedUser };
 *         },
 *
 *         DELETE: async ({ params, headers }: { params: { id: string }; headers: { authorization?: string } }) => {
 *           const user = await authMiddleware.authenticate(headers.authorization || '');
 *           if (!user || !authMiddleware.authorize(user, 'users:delete')) {
 *             return { error: 'Forbidden', status: 403 };
 *           }
 *
 *           await userService.deleteUser(params.id);
 *           return { message: 'User deleted', status: 204 };
 *         }
 *       }
     };
   });
 * ```
 */
export const defineRouterFactory: DefineRouterFactory = {
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
