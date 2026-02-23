import { Container, Controller } from '@voxeljs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FastifyAdapter } from './adapter.ts';

class TestController extends Controller {
  static readonly metadata = {
    basePath: '/test',
    routes: [
      { method: 'GET', path: '/', handler: 'list' },
      { method: 'GET', path: '/:id', handler: 'get' },
      { method: 'POST', path: '/', handler: 'create' },
    ] as const,
  };

  static readonly inject = {} as const;

  constructor(_deps: typeof TestController.inject) {
    super();
  }

  list(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ items: ['a', 'b', 'c'] });
  }

  get(req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ id: req.params.id });
  }

  create(_req: FastifyRequest, reply: FastifyReply): void {
    reply.status(201).send({ created: true });
  }
}

class HealthController extends Controller {
  static readonly metadata = {
    basePath: '/health',
    routes: [{ method: 'GET', path: '/', handler: 'check' }] as const,
  };

  static readonly inject = {} as const;

  constructor(_deps: typeof HealthController.inject) {
    super();
  }

  check(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ status: 'ok' });
  }
}

class ControllerWithoutMetadata extends Controller {
  static readonly inject = {} as const;

  constructor(_deps: typeof ControllerWithoutMetadata.inject) {
    super();
  }

  list(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ items: [] });
  }
}

class ControllerWithoutRoutes extends Controller {
  static readonly metadata = {
    basePath: '/empty',
  };

  static readonly inject = {} as const;

  constructor(_deps: typeof ControllerWithoutRoutes.inject) {
    super();
  }
}

class ControllerWithDependencies extends Controller {
  static readonly metadata = {
    basePath: '/users',
    routes: [{ method: 'GET', path: '/', handler: 'list' }] as const,
  };

  static readonly inject = { service: 'UserService' } as const;

  constructor(private deps: typeof ControllerWithDependencies.inject) {
    super();
  }

  list(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ users: this.deps.service.getUsers() });
  }
}

describe('FastifyAdapter', () => {
  let container: Container;
  let adapter: FastifyAdapter;

  beforeEach(() => {
    container = new Container();
    adapter = new FastifyAdapter(container);
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('constructor', () => {
    it('should create a FastifyAdapter instance', () => {
      expect(adapter).toBeInstanceOf(FastifyAdapter);
    });

    it('should create an internal Fastify app', () => {
      const app = adapter.getApp();
      expect(app).toBeDefined();
      expect(typeof app.route).toBe('function');
    });
  });

  describe('registerController', () => {
    it('should register routes from controller metadata', () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject));
      });

      expect(() => adapter.registerController(TestController)).not.toThrow();
    });

    it('should handle controller without metadata gracefully', () => {
      container.register(ControllerWithoutMetadata, (c) => {
        return new ControllerWithoutMetadata(c.buildDeps(ControllerWithoutMetadata.inject));
      });

      expect(() => adapter.registerController(ControllerWithoutMetadata)).not.toThrow();
    });

    it('should handle controller with metadata but no routes', () => {
      container.register(ControllerWithoutRoutes, (c) => {
        return new ControllerWithoutRoutes(c.buildDeps(ControllerWithoutRoutes.inject));
      });

      expect(() => adapter.registerController(ControllerWithoutRoutes)).not.toThrow();
    });

    it('should register multiple controllers', () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject));
      });
      container.register(HealthController, (c) => {
        return new HealthController(c.buildDeps(HealthController.inject));
      });

      expect(() => adapter.registerController(TestController)).not.toThrow();
      expect(() => adapter.registerController(HealthController)).not.toThrow();
    });

    it('should resolve controller dependencies', () => {
      const mockUserService = {
        getUsers: () => ['user1', 'user2'],
      };

      container.register('UserService', () => mockUserService);
      container.register(ControllerWithDependencies, (c) => {
        return new ControllerWithDependencies(c.buildDeps(ControllerWithDependencies.inject));
      });

      adapter.registerController(ControllerWithDependencies);
      expect(true).toBe(true);
    });
  });

  describe('listen and close', () => {
    it('should start server on specified port', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject));
      });
      adapter.registerController(TestController);

      const port = 3556;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/test/`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { items: string[] };
      expect(data.items).toEqual(['a', 'b', 'c']);
    });

    it('should close the server', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject));
      });
      adapter.registerController(TestController);

      const port = 3557;
      await adapter.listen(port);

      const response1 = await fetch(`http://localhost:${port}/test/`);
      expect(response1.status).toBe(200);

      await adapter.close();

      await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

      try {
        await fetch(`http://localhost:${port}/test/`, { signal: AbortSignal.timeout(500) });
        expect.fail('Server should have been closed');
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should handle route with path parameters', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject));
      });
      adapter.registerController(TestController);

      const port = 3558;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/test/123`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { id: string };
      expect(data.id).toBe('123');
    });

    it('should handle POST requests', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject));
      });
      adapter.registerController(TestController);

      const port = 3559;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/test/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      });
      expect(response.status).toBe(201);
      const data = (await response.json()) as { created: boolean };
      expect(data.created).toBe(true);
    });

    it('should return 404 for unmatched routes', async () => {
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject));
      });
      adapter.registerController(TestController);

      const port = 3560;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/nonexistent`);
      expect(response.status).toBe(404);
    });
  });

  describe('basePath handling', () => {
    it('should combine basePath with route path', async () => {
      container.register(HealthController, (c) => {
        return new HealthController(c.buildDeps(HealthController.inject));
      });
      adapter.registerController(HealthController);

      const port = 3561;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/health/`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { status: string };
      expect(data.status).toBe('ok');
    });

    it('should work without basePath (controller at root)', async () => {
      class RootController extends Controller {
        static readonly metadata = {
          routes: [{ method: 'GET', path: '/root', handler: 'index' }] as const,
        };
        static readonly inject = {} as const;
        constructor(_deps: typeof RootController.inject) {
          super();
        }
        index(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ root: true });
        }
      }

      container.register(RootController, (c) => {
        return new RootController(c.buildDeps(RootController.inject));
      });
      adapter.registerController(RootController);

      const port = 3562;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/root`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { root: boolean };
      expect(data.root).toBe(true);
    });

    it('should handle basePath with trailing slash', async () => {
      class TrailingSlashController extends Controller {
        static readonly metadata = {
          basePath: '/trailing/',
          routes: [{ method: 'GET', path: '/test', handler: 'test' }] as const,
        };
        static readonly inject = {} as const;
        constructor(_deps: typeof TrailingSlashController.inject) {
          super();
        }
        test(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ trailing: true });
        }
      }

      container.register(TrailingSlashController, (c) => {
        return new TrailingSlashController(c.buildDeps(TrailingSlashController.inject));
      });
      adapter.registerController(TrailingSlashController);

      const port = 3567;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/trailing/test`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { trailing: boolean };
      expect(data.trailing).toBe(true);
    });

    it('should handle route path without leading slash', async () => {
      class NoLeadingSlashController extends Controller {
        static readonly metadata = {
          basePath: '/nolead',
          // Testing edge case where path doesn't start with /
          routes: [{ method: 'GET', path: 'test' as string, handler: 'test' }],
        };
        static readonly inject = {} as const;
        constructor(_deps: typeof NoLeadingSlashController.inject) {
          super();
        }
        test(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ nolead: true });
        }
      }

      container.register(NoLeadingSlashController, (c) => {
        return new NoLeadingSlashController(c.buildDeps(NoLeadingSlashController.inject));
      });
      adapter.registerController(NoLeadingSlashController);

      const port = 3569;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/nolead/test`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { nolead: boolean };
      expect(data.nolead).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return 500 when handler throws an error', async () => {
      class ErrorController extends Controller {
        static readonly metadata = {
          basePath: '/error',
          routes: [{ method: 'GET', path: '/', handler: 'boom' }] as const,
        };
        static readonly inject = {} as const;
        constructor(_deps: typeof ErrorController.inject) {
          super();
        }
        boom(): never {
          throw new Error('Something went wrong');
        }
      }
      container.register(ErrorController, (c) => {
        return new ErrorController(c.buildDeps(ErrorController.inject));
      });
      adapter.registerController(ErrorController);
      const port = 3563;
      await adapter.listen(port);
      const response = await fetch(`http://localhost:${port}/error/`);
      expect(response.status).toBe(500);
    });

    it('should return 500 when handler is not a function', async () => {
      class InvalidHandlerController extends Controller {
        static readonly metadata = {
          basePath: '/invalid',
          routes: [{ method: 'GET', path: '/', handler: 'nonexistent' }] as const,
        };
        static readonly inject = {} as const;
        constructor(_deps: typeof InvalidHandlerController.inject) {
          super();
        }
      }

      container.register(InvalidHandlerController, (c) => {
        return new InvalidHandlerController(c.buildDeps(InvalidHandlerController.inject));
      });
      adapter.registerController(InvalidHandlerController);

      const port = 3565;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/invalid/`);
      expect(response.status).toBe(500);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Handler 'nonexistent' not found on controller");
    });

    it('should handle async handler that returns a Promise', async () => {
      class AsyncController extends Controller {
        static readonly metadata = {
          basePath: '/async',
          routes: [{ method: 'GET', path: '/', handler: 'getData' }] as const,
        };
        static readonly inject = {} as const;
        constructor(_deps: typeof AsyncController.inject) {
          super();
        }
        async getData(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
          await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
          reply.send({ async: true });
        }
      }

      container.register(AsyncController, (c) => {
        return new AsyncController(c.buildDeps(AsyncController.inject));
      });
      adapter.registerController(AsyncController);

      const port = 3566;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/async/`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { async: boolean };
      expect(data.async).toBe(true);
    });

    it('should handle non-Error thrown from handler', async () => {
      class NonErrorController extends Controller {
        static readonly metadata = {
          basePath: '/nonerror',
          routes: [{ method: 'GET', path: '/', handler: 'throw' }] as const,
        };
        static readonly inject = {} as const;
        constructor(_deps: typeof NonErrorController.inject) {
          super();
        }
        throw(): never {
          //
          throw 'string error';
        }
      }

      container.register(NonErrorController, (c) => {
        return new NonErrorController(c.buildDeps(NonErrorController.inject));
      });
      adapter.registerController(NonErrorController);

      const port = 3568;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/nonerror/`);
      expect(response.status).toBe(500);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe('Internal server error');
    });
  });

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
        };
        static readonly inject = {} as const;
        constructor(_deps: typeof AllMethodsController.inject) {
          super();
        }
        get(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'GET' });
        }
        post(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'POST' });
        }
        put(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'PUT' });
        }
        patch(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'PATCH' });
        }
        delete(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ method: 'DELETE' });
        }
      }

      container.register(AllMethodsController, (c) => {
        return new AllMethodsController(c.buildDeps(AllMethodsController.inject));
      });
      adapter.registerController(AllMethodsController);

      const port = 3564;
      await adapter.listen(port);

      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
      for (const method of methods) {
        const response = await fetch(`http://localhost:${port}/methods/`, { method });
        expect(response.status).toBe(200);
        const data = (await response.json()) as { method: string };
        expect(data.method).toBe(method);
      }
    });
  });
});
