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
 * Abstract base class for Voxel controllers
 *
 * Controllers define HTTP routes using a static metadata object.
 * The routes array maps HTTP methods and paths to handler methods.
 *
 * @example
 * interface UserRequest {
 *   params: { id: string }
 *   body: { name: string }
 * }
 *
 * class UserController extends Controller {
 *   static readonly inject = {
 *     users: 'UserService'
 *   } as const
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
 *   constructor(private deps: typeof UserController.inject) {
 *     super()
 *   }
 *
 *   async list() {
 *     return this.deps.users.findAll()
 *   }
 *
 *   async get(req: UserRequest) {
 *     return this.deps.users.findById(req.params.id)
 *   }
 *
 *   async create(req: { body: { name: string } }) {
 *     return this.deps.users.create(req.body)
 *   }
 * }
 */
export abstract class Controller {
  /**
   * Static metadata describing the controller's configuration
   *
   * Override this property to define the controller's routes and base path.
   */
  static readonly metadata?: ControllerMetadata;
}
