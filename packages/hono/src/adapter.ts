import { Hono, type Context } from 'hono'
import { serve, type ServerType } from '@hono/node-server'
import type { ControllerConstructor, ResolverInterface, HttpMethod } from '@voxeljs/core'

export class HonoAdapter {
  private readonly app: Hono
  private readonly container: ResolverInterface
  private server: ServerType | undefined

  constructor(container: ResolverInterface) {
    this.container = container
    this.app = new Hono({ strict: false })
  }

  getApp(): Hono {
    return this.app
  }

  registerController(ControllerClass: ControllerConstructor): void {
    const metadata = ControllerClass.metadata
    if (metadata?.routes === undefined) {
      return
    }

    const basePath = metadata.basePath ?? ''

    for (const route of metadata.routes) {
      const fullPath = this.joinPath(basePath, route.path)
      const method = route.method.toUpperCase() as HttpMethod

      this.app.on(method, fullPath, async (c: Context): Promise<Response> => {
        try {
          const controller = this.container.resolve(ControllerClass)
          const handlerMethod = controller[route.handler as keyof typeof controller]

          if (typeof handlerMethod !== 'function') {
            return c.json({ error: `Handler '${route.handler}' not found on controller` }, 500)
          }

          const syncResult = (handlerMethod as (c: Context) => unknown).call(
            controller,
            c
          )

          const result = await Promise.resolve(syncResult)

          if (result instanceof Response) {
            return result
          }
          if (
            result !== null &&
            typeof result === 'object' &&
            'status' in result &&
            'headers' in result &&
            typeof (result as Response).status === 'number'
          ) {
            return result as Response
          }

          return c.body(null)
        } catch (error) {
          return c.json({
            error: error instanceof Error ? error.message : 'Internal server error',
          }, 500)
        }
      })
    }
  }

  private joinPath(basePath: string, routePath: string): string {
    if (basePath === '') {
      return routePath
    }
    if (routePath === '/' || routePath === '') {
      return basePath
    }
    const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
    const normalizedRoute = routePath.startsWith('/') ? routePath : '/' + routePath
    return normalizedBase + normalizedRoute
  }

  async listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = serve({
          fetch: (req) => this.app.fetch(req),
          port,
          hostname: '0.0.0.0',
        })

        this.server.once('listening', () => {
          resolve()
        })

        this.server.once('error', (err: Error) => {
          reject(err)
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server === undefined) {
        resolve()
        return
      }
      this.server.close((err: Error | undefined) => {
        if (err !== undefined && err !== null) {
          reject(err)
        } else {
          this.server = undefined
          resolve()
        }
      })
    })
  }
}
