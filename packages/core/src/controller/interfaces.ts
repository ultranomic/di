import type { HttpMethod } from '../types/controller.js'
import type { ControllerMetadata, Controller } from './controller.js'

/**
 * RouteInfo represents runtime route data extracted from a controller
 *
 * This is the flattened, normalized representation of a route that combines
 * the controller's base path with the route path.
 */
export interface RouteInfo {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  readonly method: HttpMethod
  /** Full path including basePath (e.g., '/users/:id') */
  readonly path: string
  /** Handler method name on the controller */
  readonly handler: string
  /** Reference to the controller class */
  readonly controller: ControllerConstructor
}

/**
 * ControllerConstructor defines the type for controller classes
 *
 * This type ensures that controller classes have the required static metadata
 * and can be instantiated to create controller instances.
 *
 * @example
 * const ControllerClass: ControllerConstructor = UserController
 * const routes = ControllerClass.metadata?.routes
 */
export type ControllerConstructor = {
  /**
   * Static metadata describing the controller's configuration
   */
  readonly metadata?: ControllerMetadata
} & (abstract new (...args: any[]) => Controller)
