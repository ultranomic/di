import type { HttpMethod } from '../types/controller.ts';
import type { Token } from '../types/token.ts';
import type { Controller, ControllerMetadata } from './controller.ts';

/**
 * RouteInfo represents runtime route data extracted from a controller
 *
 * This is the flattened, normalized representation of a route that combines
 * the controller's base path with the route path.
 */
export interface RouteInfo {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  readonly method: HttpMethod;
  /** Full path including basePath (e.g., '/users/:id') */
  readonly path: string;
  /** Handler method name on the controller */
  readonly handler: string;
  /** Reference to the controller class */
  readonly controller: ControllerConstructor;
}

/**
 * ControllerConstructor defines the type for controller classes
 *
 * This type ensures that controller classes have the required static metadata
 * and inject properties, and can be instantiated to create controller instances.
 *
 * Controllers use the new array-based inject pattern with individual constructor
 * parameters.
 *
 * @example
 * class MyController extends Controller {
 *   static readonly inject: DepsTokens<typeof this> = [Logger];
 *   static readonly metadata: ControllerMetadata = { basePath: '/api' };
 *   constructor(public logger: Logger) { super() }
 * }
 *
 * const ControllerClass: ControllerConstructor = MyController
 * const routes = ControllerClass.metadata?.routes
 */
export type ControllerConstructor = {
  /**
   * Static dependencies array for constructor injection
   */
  readonly inject?: readonly Token[];
  /**
   * Static metadata describing the controller's configuration
   */
  readonly metadata?: ControllerMetadata;
  /**
   * Creates a new controller instance
   */
  // oxlint-disable-next-line typescript-eslint(no-explicit-any)
  new (...args: any[]): Controller;
};
