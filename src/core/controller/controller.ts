import type { ControllerRoute } from '../types/controller.ts';
import { Injectable, type InjectableConstructor } from '../types/injectable.ts';

/**
 * Controller metadata interface
 *
 * Defines the configuration for a controller including its base path
 * and route definitions.
 *
 * @example
 * class UserController extends Controller {
 *   static readonly metadata = {
 *     basePath: '/users',
 *     routes: [
 *       { method: 'GET', path: '/', handler: 'list' },
 *       { method: 'GET', path: '/:id', handler: 'get' },
 *       { method: 'POST', path: '/', handler: 'create' }
 *     ] as const satisfies ControllerRoute<UserController>[]
 *   }
 * }
 */
export interface ControllerMetadata<T> {
  /**
   * Base path for all routes in this controller
   * All routes will be prefixed with this path
   *
   * @example
   * basePath: '/users' // routes become /users/, /users/:id, etc.
   */
  basePath?: string;

  /**
   * Route definitions for this controller
   *
   * Each route maps an HTTP method and path to a handler method.
   * The handler name is validated against the controller's methods.
   */
  routes?: readonly ControllerRoute<T>[];
}

/**
 * Abstract base class for DI controllers
 *
 * Controllers define HTTP routes using a static metadata object.
 * The routes array maps HTTP methods and paths to handler methods.
 *
 * Dependencies are injected using the `inject` static property with
 * individual constructor parameters.
 *
 * @example
 * class UserService {
 *   findAll() { return [] }
 *   findById(id: string) { return { id } }
 *   create(data: { name: string }) { return { ...data, id: '1' } }
 * }
 *
 * class UserController extends Controller {
 *   static readonly inject = [UserService] as const satisfies DependencyTokens<typeof this>;
 *
 *   static readonly metadata = {
 *     basePath: '/users',
 *     routes: [
 *       { method: 'GET', path: '/', handler: 'list' },
 *       { method: 'GET', path: '/:id', handler: 'get' },
 *       { method: 'POST', path: '/', handler: 'create' }
 *     ] as const satisfies ControllerRoute<UserController>[]
 *   }
 *
 *   constructor(private users: UserService) {
 *     super();
 *   }
 *
 *   async list() {
 *     return this.users.findAll()
 *   }
 *
 *   async get(req: { params: { id: string } }) {
 *     return this.users.findById(req.params.id)
 *   }
 *
 *   async create(req: { body: { name: string } }) {
 *     return this.users.create(req.body)
 *   }
 * }
 */
export abstract class Controller extends Injectable {
  /**
   * Static dependencies array for constructor injection.
   *
   * Use the array-based inject pattern with individual constructor parameters.
   *
   * @example
   * static readonly inject = [Logger, UserService] as const satisfies DependencyTokens<typeof MyController>;
   */
  static readonly inject?: readonly InjectableConstructor[];

  /**
   * Static metadata describing the controller's configuration
   *
   * Override this property to define the controller's routes and base path.
   * Use `satisfies ControllerMetadata` for type-safe handler names.
   *
   * @example
   * class UserController extends Controller {
   *   static readonly metadata = {
   *     basePath: '/users',
   *     routes: [{ method: 'GET', path: '/', handler: 'list' }]
   *   } as const satisfies ControllerMetadata<typeof this>;
   * }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static readonly metadata?: ControllerMetadata<any>;
}
