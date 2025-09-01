import { defineInjectableFactory, type Injectable } from './define-injectable-factory.ts';

/**
 * Represents a router component that handles routing logic and endpoint definitions.
 * Routers are injectable containers that typically contain route handlers, middleware, and routing configuration.
 * @template T - The type of the router's exported interface
 */
export type Router<T = unknown> = Injectable<T>;

/**
 * The main factory interface for creating router factories.
 * Provides a fluent API for defining named routers with optional dependencies.
 */
type DefineRouterFactory = {
  name<TName extends string>(routerName: TName): NamedRouterFactoryBuilder<TName>;
};

/**
 * Builder for creating a named router factory.
 * Allows specifying whether the router has dependencies or not.
 * @template TName - The name of the router
 */
type NamedRouterFactoryBuilder<TName extends string> = {
  inject(): RouterFactoryBuilderNoDeps<TName>;
  inject<TInject extends Record<string, Injectable<unknown>>>(): RouterFactoryBuilderWithDeps<TName, TInject>;
};

/**
 * Builder for routers that don't have dependencies.
 * @template TName - The name of the router
 */
type RouterFactoryBuilderNoDeps<TName extends string> = {
  handler<S extends Record<string | symbol, unknown> | void>(
    fn: (params: {
      name: TName;
      injector: never;
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      };
    }) => S,
  ): () => Router<S>;
};

/**
 * Builder for routers that have dependencies.
 * @template TName - The name of the router
 * @template TInject - Record of dependency names to their injectable types
 */
type RouterFactoryBuilderWithDeps<TName extends string, TInject extends Record<string, Injectable<unknown>>> = {
  handler<S extends Record<string | symbol, unknown> | void>(
    fn: (params: {
      name: TName;
      injector: () => TInject;
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      };
    }) => S,
  ): (injector: () => TInject) => Router<S>;
};

/**
 * Factory for creating router components with optional dependency injection support.
 * Routers handle HTTP routing, middleware, and endpoint definitions for web applications.
 *
 * @example
 * ```typescript
 * // Router without dependencies
 * const apiRouter = defineRouterFactory
 *   .name('apiRouter')
 *   .inject()
 *   .handler(() => ({
 *     routes: [
 *       { path: '/api/users', method: 'GET', handler: getUsersHandler },
 *       { path: '/api/users', method: 'POST', handler: createUserHandler },
 *     ],
 *     middleware: [authMiddleware, loggingMiddleware],
 *   }));
 *
 * // Router with dependencies
 * const userRouter = defineRouterFactory
 *   .name('userRouter')
 *   .inject<{ userService: Injectable<{ getUsers: Function }> }>()
 *   .handler(({ injector }) => {
 *     const deps = injector();
 *     return {
 *       getUsers: (req: Request, res: Response) => {
 *         const users = deps.userService.getUsers();
 *         res.json(users);
 *       },
 *     };
 *   });
 * ```
 */
export const defineRouterFactory: DefineRouterFactory = {
  name: (name) => ({
    inject: () => ({
      handler: (fn: any) => (injectorOrNothing?: unknown) =>
        defineInjectableFactory.name(name).inject<any>().handler(fn)(injectorOrNothing as any) as any,
    }),
  }),
};
