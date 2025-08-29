import { defineInjectable, type Injectable } from './define-injectable.ts';

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
 * Main interface for the defineRouter utility.
 * Builds on defineInjectable with router-specific constraints for HTTP endpoint definitions.
 */
type DefineRouter = {
  /**
   * Creates a router without dependencies.
   * Routers must return Record types with string or symbol keys, or void.
   * 
   * @template S - The return type of the router (must be Record<string | symbol, unknown> or void)
   * @param fn - Factory function that returns the router implementation
   * @returns A factory function that creates the router instance
   */
  handler<S extends Record<string | symbol, unknown> | void>(fn: () => S): () => Router<S>;

  /**
   * Creates a builder for routers that require dependencies.
   * 
   * @template T - Record type defining the required injectable dependencies
   * @returns A RouterBuilder instance for configuring the router
   */
  inject<T extends Record<string, Injectable<unknown>>>(): RouterBuilder<T>;
};

/**
 * Builder interface for creating routers with dependencies.
 * Routers can depend on services, modules, middleware, and other injectable components.
 * 
 * @template T - Record type defining the required dependencies
 */
type RouterBuilder<T> = {
  /**
   * Defines the handler function for the router with dependencies.
   * 
   * @template S - The return type of the router (must be Record<string | symbol, unknown> or void)
   * @param fn - Factory function that receives injector and lifecycle hooks
   * @param fn.injector - Function that provides access to injected dependencies
   * @param fn.appHooks - Object containing application lifecycle hook registrars
   * @param fn.appHooks.onApplicationStart - Register callback for application start event
   * @param fn.appHooks.onApplicationStop - Register callback for application stop event
   * @returns A factory function that accepts an injector and creates the router
   */
  handler<S extends Record<string | symbol, unknown> | void>(
    fn: (
      injector: () => T,
      appHooks: {
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      },
    ) => S,
  ): (injector: () => T) => Router<S>;
};

/**
 * Utility for creating type-safe router components that define HTTP endpoints and API routing logic.
 * Routers provide a generic foundation for organizing endpoint handlers and can be used with any HTTP framework.
 * 
 * Routers are ideal for:
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
 * // Simple router without dependencies
 * const healthRouter = defineRouter.handler(() => ({
 *   '/health': {
 *     GET: () => ({ status: 'ok', timestamp: new Date().toISOString() })
 *   },
 *   '/version': {
 *     GET: () => ({ version: '1.0.0' })
 *   }
 * }));
 * 
 * // Complex router with dependencies and full CRUD operations
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
 * const userRouter = defineRouter
 *   .inject<Dependencies>()
 *   .handler((injector, { onApplicationStart }) => {
 *     const { userService, authMiddleware, logger } = injector();
 *     
 *     onApplicationStart(() => {
 *       logger.log('User router initialized');
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
 *     };
 *   });
 * ```
 */
export const defineRouter: DefineRouter = {
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
