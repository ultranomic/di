import express, { type Express, type Request, type Response } from 'express'
import type { Server } from 'node:http'
import type { ControllerConstructor, ResolverInterface, HttpMethod } from '@voxeljs/core'

export class ExpressAdapter {
  private readonly app: Express
  private readonly container: ResolverInterface
  private server: Server | undefined

  constructor(container: ResolverInterface) {
    this.container = container
    this.app = express()
    this.app.use(express.json())
  }

  getApp(): Express {
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
      const method = route.method.toLowerCase() as Lowercase<HttpMethod>

      const handler = async (req: Request, res: Response): Promise<void> => {
        try {
          const controller = this.container.resolve(ControllerClass)
          const handlerMethod = controller[route.handler as keyof typeof controller]
          
          if (typeof handlerMethod !== 'function') {
            res.status(500).json({ error: `Handler '${route.handler}' not found on controller` })
            return
          }

          const result = (handlerMethod as (req: Request, res: Response) => unknown).call(
            controller,
            req,
            res
          )
          
          if (result instanceof Promise) {
            await result
          }
        } catch (error) {
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error',
          })
        }
      }

      this.app[method](fullPath, handler)
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
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        resolve()
      })
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
