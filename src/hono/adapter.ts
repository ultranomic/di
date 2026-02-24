import { Hono, type Context } from 'hono';
import { serve, type ServerType } from '@hono/node-server';
import type { ControllerConstructor, ResolverInterface, HttpMethod } from '../core/index.js';
import { joinPath } from '../core/utils/path.js';

/**
 * Hono adapter with RPC type inference support
 *
 * This adapter registers controllers using Hono's chain pattern (get, post, etc.)
 * to enable proper type inference for RPC clients.
 *
 * @example
 * ```typescript
 * const adapter = new HonoAdapter(container)
 * adapter.registerController(UserController)
 *
 * // Export the app type for RPC client usage
 * export type AppType = typeof adapter.getApp()
 * ```
 */
export class HonoAdapter {
  private readonly app: Hono;
  private readonly container: ResolverInterface;
  private server: ServerType | undefined;

  constructor(container: ResolverInterface) {
    this.container = container;
    this.app = new Hono({ strict: false });
  }

  /**
   * Returns the Hono app instance for RPC type inference
   *
   * Use this to export the app type for client-side type safety:
   * ```typescript
   * export type AppType = typeof adapter.getApp()
   * ```
   *
   * Then in your client:
   * ```typescript
   * import { hc } from 'hono/client'
   * import type { AppType } from './server'
   * const client = hc<AppType>('http://localhost:3000')
   * ```
   */
  getApp(): Hono {
    return this.app;
  }

  registerController(ControllerClass: ControllerConstructor): void {
    const metadata = ControllerClass.metadata;
    if (metadata?.routes === undefined) {
      return;
    }

    const basePath = metadata.basePath ?? '';

    for (const route of metadata.routes) {
      const fullPath = joinPath(basePath, route.path);
      const method = route.method.toUpperCase() as HttpMethod;
      const handler = this.createHandler(ControllerClass, route.handler);

      this.registerRoute(method, fullPath, handler);
    }
  }

  /**
   * Registers a route using the appropriate HTTP method
   */
  private registerRoute(method: HttpMethod, path: string, handler: (c: Context) => Promise<Response>): void {
    switch (method) {
      case 'GET':
        this.app.get(path, handler);
        break;
      case 'POST':
        this.app.post(path, handler);
        break;
      case 'PUT':
        this.app.put(path, handler);
        break;
      case 'PATCH':
        this.app.patch(path, handler);
        break;
      case 'DELETE':
        this.app.delete(path, handler);
        break;
      case 'HEAD':
        this.app.on('HEAD', path, handler);
        break;
      case 'OPTIONS':
        this.app.on('OPTIONS', path, handler);
        break;
      default:
        this.app.on(method, path, handler);
        break;
    }
  }

  /**
   * Creates a route handler with error handling
   */
  private createHandler(
    ControllerClass: ControllerConstructor,
    handlerName: string,
  ): (c: Context) => Promise<Response> {
    return async (c: Context): Promise<Response> => {
      try {
        const controller = this.container.resolve(ControllerClass);
        const handlerMethod = controller[handlerName as keyof typeof controller];

        if (typeof handlerMethod !== 'function') {
          return c.json({ error: `Handler '${handlerName}' not found on controller` }, 500);
        }

        const syncResult = (handlerMethod as (c: Context) => unknown).call(controller, c);
        const result = await Promise.resolve(syncResult);

        if (result instanceof Response) {
          return result;
        }
        if (
          result !== null &&
          typeof result === 'object' &&
          'status' in result &&
          'headers' in result &&
          typeof (result as Response).status === 'number'
        ) {
          return result as Response;
        }

        return c.body(null);
      } catch (error) {
        return c.json(
          {
            error: error instanceof Error ? error.message : 'Internal server error',
          },
          500,
        );
      }
    };
  }

  async listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = serve({
          fetch: (req) => this.app.fetch(req),
          port,
          hostname: '0.0.0.0',
        });

        this.server.once('listening', () => {
          resolve();
        });

        this.server.once('error', (err: Error) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server === undefined) {
        resolve();
        return;
      }
      this.server.close((err: Error | undefined) => {
        if (err !== undefined && err !== null) {
          reject(err);
        } else {
          this.server = undefined;
          resolve();
        }
      });
    });
  }
}
