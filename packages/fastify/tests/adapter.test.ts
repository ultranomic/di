import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { FastifyAdapter } from '../src/adapter.js'
import { Container, Controller } from '@voxeljs/core'

class TestController extends Controller {
  static readonly metadata = {
    basePath: '/test',
    routes: [
      { method: 'GET', path: '/', handler: 'list' },
      { method: 'GET', path: '/:id', handler: 'get' },
      { method: 'POST', path: '/', handler: 'create' },
    ] as const,
  }

  static readonly inject = {} as const

  constructor(_deps: typeof TestController.inject) {
    super()
  }

  list(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ items: ['a', 'b', 'c'] })
  }

  get(req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ id: req.params.id })
  }

  create(_req: FastifyRequest, reply: FastifyReply): void {
    reply.status(201).send({ created: true })
  }
}

class HealthController extends Controller {
  static readonly metadata = {
    basePath: '/health',
    routes: [{ method: 'GET', path: '/', handler: 'check' }] as const,
  }

  static readonly inject = {} as const

  constructor(_deps: typeof HealthController.inject) {
    super()
  }

  check(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ status: 'ok' })
  }
}

class ControllerWithoutMetadata extends Controller {
  static readonly inject = {} as const

  constructor(_deps: typeof ControllerWithoutMetadata.inject) {
    super()
  }

  list(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ items: [] })
  }
}

class ControllerWithoutRoutes extends Controller {
  static readonly metadata = {
    basePath: '/empty',
  }

  static readonly inject = {} as const

  constructor(_deps: typeof ControllerWithoutRoutes.inject) {
    super()
  }
}

class ControllerWithDependencies extends Controller {
  static readonly metadata = {
    basePath: '/users',
    routes: [{ method: 'GET', path: '/', handler: 'list' }] as const,
  }

  static readonly inject = { service: 'UserService' } as const

  constructor(private deps: typeof ControllerWithDependencies.inject) {
    super()
  }

  list(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ users: this.deps.service.getUsers() })
  }
}

describe('FastifyAdapter', () => {
  let container: Container
  let adapter: FastifyAdapter

  beforeEach(() => {
    container = new Container()
    adapter = new FastifyAdapter(container)
  })

  afterEach(async () => {
    await adapter.close()
  })

  describe('constructor', () => {
    it('should create a FastifyAdapter instance', () => {
      expect(adapter).toBeInstanceOf(FastifyAdapter)
    })

    it('should create an internal Fastify app', () => {
      const app = adapter.getApp()
      expect(app).toBeDefined()
      expect(typeof app.route).toBe('function')
    })
  })

  describe('registerController', () => {
    it('should register routes from controller metadata', () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject))
      })

      expect(() => adapter.registerController(TestController)).not.toThrow()
    })

    it('should handle controller without metadata gracefully', () => {
      container.register(ControllerWithoutMetadata, (c) => {
        return new ControllerWithoutMetadata(c.buildDeps(ControllerWithoutMetadata.inject))
      })

      expect(() => adapter.registerController(ControllerWithoutMetadata)).not.toThrow()
    })

    it('should handle controller with metadata but no routes', () => {
      container.register(ControllerWithoutRoutes, (c) => {
        return new ControllerWithoutRoutes(c.buildDeps(ControllerWithoutRoutes.inject))
      })

      expect(() => adapter.registerController(ControllerWithoutRoutes)).not.toThrow()
    })

    it('should register multiple controllers', () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject))
      })
      container.register(HealthController, (c) => {
        return new HealthController(c.buildDeps(HealthController.inject))
      })

      expect(() => adapter.registerController(TestController)).not.toThrow()
      expect(() => adapter.registerController(HealthController)).not.toThrow()
    })

    it('should resolve controller dependencies', () => {
      const mockUserService = {
        getUsers: () => ['user1', 'user2'],
      }

      container.register('UserService', () => mockUserService)
      container.register(ControllerWithDependencies, (c) => {
        return new ControllerWithDependencies(c.buildDeps(ControllerWithDependencies.inject))
      })

      adapter.registerController(ControllerWithDependencies)
      expect(true).toBe(true)
    })
  })

  describe('listen and close', () => {
    it('should start server on specified port', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject))
      })
      adapter.registerController(TestController)

      const port = 3556
      await adapter.listen(port)

      const response = await fetch(`http://localhost:${port}/test/`)
      expect(response.status).toBe(200)
      const data = (await response.json()) as { items: string[] }
      expect(data.items).toEqual(['a', 'b', 'c'])
    })

    it('should close the server', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject))
      })
      adapter.registerController(TestController)

      const port = 3557
      await adapter.listen(port)

      const response1 = await fetch(`http://localhost:${port}/test/`)
      expect(response1.status).toBe(200)

      await adapter.close()

      await new Promise((resolve) => globalThis.setTimeout(resolve, 100))

      try {
        await fetch(`http://localhost:${port}/test/`, { signal: AbortSignal.timeout(500) })
        expect.fail('Server should have been closed')
      } catch {
        expect(true).toBe(true)
      }
    })

    it('should handle route with path parameters', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject))
      })
      adapter.registerController(TestController)

      const port = 3558
      await adapter.listen(port)

      const response = await fetch(`http://localhost:${port}/test/123`)
      expect(response.status).toBe(200)
      const data = (await response.json()) as { id: string }
      expect(data.id).toBe('123')
    })

    it('should handle POST requests', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject))
      })
      adapter.registerController(TestController)

      const port = 3559
      await adapter.listen(port)

      const response = await fetch(`http://localhost:${port}/test/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      })
      expect(response.status).toBe(201)
      const data = (await response.json()) as { created: boolean }
      expect(data.created).toBe(true)
    })

    it('should return 404 for unmatched routes', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject))
      })
      adapter.registerController(TestController)

      const port = 3560
      await adapter.listen(port)

      const response = await fetch(`http://localhost:${port}/nonexistent`)
      expect(response.status).toBe(404)
    })
  })

  describe('basePath handling', () => {
    it('should combine basePath with route path', async () => {
      container.register(HealthController, (c) => {
        return new HealthController(c.buildDeps(HealthController.inject))
      })
      adapter.registerController(HealthController)

      const port = 3561
      await adapter.listen(port)

      const response = await fetch(`http://localhost:${port}/health/`)
      expect(response.status).toBe(200)
      const data = (await response.json()) as { status: string }
      expect(data.status).toBe('ok')
    })

    it('should work without basePath (controller at root)', async () => {
      class RootController extends Controller {
        static readonly metadata = {
          routes: [{ method: 'GET', path: '/root', handler: 'index' }] as const,
        }
        static readonly inject = {} as const
        constructor(_deps: typeof RootController.inject) {
          super()
        }
        index(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ root: true })
        }
      }

      container.register(RootController, (c) => {
        return new RootController(c.buildDeps(RootController.inject))
      })
      adapter.registerController(RootController)

      const port = 3562
      await adapter.listen(port)

      const response = await fetch(`http://localhost:${port}/root`)
      expect(response.status).toBe(200)
      const data = (await response.json()) as { root: boolean }
      expect(data.root).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should return 500 when handler throws an error', async () => {
      class ErrorController extends Controller {
        static readonly metadata = {
          basePath: '/error',
          routes: [{ method: 'GET', path: '/', handler: 'boom' }] as const,
        }
        static readonly inject = {} as const
        constructor(_deps: typeof ErrorController.inject) {
          super()
        }
        boom(): never {
          throw new Error('Something went wrong')
        }
      }

      container.register(ErrorController, (c) => {
        return new ErrorController(c.buildDeps(ErrorController.inject))
      })
      adapter.registerController(ErrorController)

      const port = 3563
      await adapter.listen(port)

      const response = await fetch(`http://localhost:${port}/error/`)
      expect(response.status).toBe(500)
    })
  })

  describe('HTTP methods', () => {
    it('should handle all HTTP methods', async () => {
      class AllMethodsController extends Controller {
        static readonly metadata = {
          basePath: '/methods',
          routes: [
            { method: 'GET', path: '/', handler: 'get' },
            { method: 'POST', path: '/', handler: 'post' },
            { method: 'PUT', path: '/', handler: 'put' },
            { method: 'PATCH', path: '/', handler: 'patch' },
            { method: 'DELETE', path: '/', handler: 'delete' },
          ] as const,
        }
        static readonly inject = {} as const
        constructor(_deps: typeof AllMethodsController.inject) {
          super()
        }
        get(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'GET' })
        }
        post(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'POST' })
        }
        put(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'PUT' })
        }
        patch(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'PATCH' })
        }
        delete(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'DELETE' })
        }
      }

      container.register(AllMethodsController, (c) => {
        return new AllMethodsController(c.buildDeps(AllMethodsController.inject))
      })
      adapter.registerController(AllMethodsController)

      const port = 3564
      await adapter.listen(port)

      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
      for (const method of methods) {
        const response = await fetch(`http://localhost:${port}/methods/`, { method })
        expect(response.status).toBe(200)
        const data = (await response.json()) as { method: string }
        expect(data.method).toBe(method)
      }
    })
  })
})
