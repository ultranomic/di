/**
 * Controller type definitions for HTTP routing
 *
 * These types enable type-safe route definitions with path parameter
 * inference and handler name validation.
 */

/**
 * Base request interface - platform agnostic
 * Adapters will provide platform-specific implementations
 */
export interface BaseRequest<
  TParams = Record<string, string>,
  TBody = unknown,
  TQuery = Record<string, string>,
> {
  params: TParams
  body: TBody
  query: TQuery
}

/**
 * Base response interface - platform agnostic
 * Adapters will provide platform-specific implementations
 */
export interface BaseResponse {
  json(data: unknown): void
  status(code: number): this
  send(data: unknown): void
}

/**
 * Supported HTTP methods
 */
export type HttpMethod =
  | 'DELETE'
  | 'GET'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH'
  | 'POST'
  | 'PUT'

/**
 * Extract path parameters from a route path
 *
 * Parses path patterns like '/users/:id/posts/:postId' and extracts
 * the parameter names as string keys.
 *
 * @template TPath - The route path string
 *
 * @example
 * type Params1 = ExtractPathParams<'/users/:id'>
 * // { id: string }
 *
 * @example
 * type Params2 = ExtractPathParams<'/users/:userId/posts/:postId'>
 * // { userId: string; postId: string }
 *
 * @example
 * type Params3 = ExtractPathParams<'/health'>
 * // Record<string, never>
 */
export type ExtractPathParams<TPath extends string> =
  TPath extends `${infer _Prefix}:${infer Param}/${infer Rest}`
    ? {
        [K in Param | keyof ExtractPathParams<`/${Rest}`>]: string
      }
    : TPath extends `${infer _Prefix}:${infer Param}`
      ? { [K in Param]: string }
      : Record<string, never>

/**
 * Controller route definition
 *
 * Defines an HTTP route with method, path, and handler reference.
 * The handler name is validated against the controller's methods.
 *
 * @template TController - The controller class type
 *
 * @example
 * class UserController {
 *   static readonly routes = [
 *     { method: 'GET', path: '/users/:id', handler: 'getUser' },
 *     { method: 'POST', path: '/users', handler: 'createUser' }
 *   ] as const satisfies ControllerRoute<UserController>[]
 *
 *   async getUser(req: BaseRequest, res: BaseResponse) { ... }
 *   async createUser(req: BaseRequest, res: BaseResponse) { ... }
 * }
 */
export interface ControllerRoute<TController> {
  /** HTTP method */
  method: HttpMethod
  /** Route path with optional parameters (e.g., '/users/:id') */
  path: string
  /** Handler method name on the controller */
  handler: keyof TController & string
}

/**
 * Typed request interface with params, body, and query typing
 *
 * Generic typed request that can be extended by adapters.
 *
 * @template TParams - Path parameter types
 * @template TBody - Request body type
 * @template TQuery - Query string parameter types
 *
 * @example
 * interface GetUserParams {
 *   id: string
 * }
 *
 * async getUser(req: TypedRequest<GetUserParams>, res: BaseResponse) {
 *   const id = req.params.id // typed as string
 * }
 */
export interface TypedRequest<
  TParams = Record<string, string>,
  TBody = unknown,
  TQuery = Record<string, string>,
> extends BaseRequest<TParams, TBody, TQuery> {
  /** Path parameters (e.g., /users/:id) */
  params: TParams & Record<string, string>
  /** Request body */
  body: TBody
  /** Query string parameters */
  query: TQuery & Record<string, string>
}

/**
 * Typed response helper for type-safe response typing
 *
 * Generic typed response that can be extended by adapters.
 */
export interface TypedResponse extends BaseResponse {}
