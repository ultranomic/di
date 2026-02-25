import type { Token } from '../types/token.ts';

/**
 * Controller metadata interface
 *
 * Defines the configuration for a controller including its base path
 * and route definitions.
 *
 * @example
 * class UserController extends Controller {
 *   static readonly metadata: ControllerMetadata = {
 *     basePath: '/users',
 *     routes: [
 *       { method: 'GET', path: '/', handler: 'list' },
 *       { method: 'GET', path: '/:id', handler: 'get' },
 *       { method: 'POST', path: '/', handler: 'create' }
 *     ] as const satisfies ControllerRoute<UserController>[]
 *   }
 * }
 */
export interface ControllerMetadata {
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
  routes?: readonly {
    method: import('../types/controller.ts').HttpMethod;
    path: string;
    handler: string;
  }[];
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
 *   static readonly inject: DepsTokens<typeof this> = [UserService];
 *
 *   static readonly metadata: ControllerMetadata = {
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
export abstract class Controller {
  /**
   * Static dependencies array for constructor injection.
   *
   * Use the array-based inject pattern with individual constructor parameters.
   *
   * @example
   * static readonly inject = [Logger, UserService] as const satisfies DepsTokens<typeof MyController>;
   */
  static readonly inject?: readonly Token[];

  /**
   * Static metadata describing the controller's configuration
   *
   * Override this property to define the controller's routes and base path.
   */
  static readonly metadata?: ControllerMetadata;
}
