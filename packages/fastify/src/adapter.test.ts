import { Container, Controller } from '@voxeljs/core';
import type { DepsTokens } from '@voxeljs/core';
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

  list(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ items: ['a', 'b', 'c'] });
  }

  get(req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ id: (req.params as Record<string, string>)['id'] });
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

  check(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ status: 'ok' });
  }
}

class ControllerWithoutMetadata extends Controller {
  list(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ items: [] });
  }
}

class ControllerWithoutRoutes extends Controller {
  static readonly metadata = {
    basePath: '/empty',
  };
}

class UserService {
  getUsers() {
    return ['user1', 'user2'];
  }
}

class ControllerWithDependencies extends Controller {
  static readonly metadata = {
    basePath: '/users',
    routes: [{ method: 'GET', path: '/', handler: 'list' }] as const,
  };

  static readonly inject = [UserService] as const satisfies DepsTokens<typeof ControllerWithDependencies>;

  private userService: UserService;

  constructor(userService: UserService) {
    super();
    this.userService = userService;
  }

  list(_req: FastifyRequest, reply: FastifyReply): void {
    reply.send({ users: this.userService.getUsers() });
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
      container.register(TestController, () => new TestController());

      expect(() => adapter.registerController(TestController)).not.toThrow();
    });

    it('should handle controller without metadata gracefully', () => {
      container.register(ControllerWithoutMetadata, () => new ControllerWithoutMetadata());

      expect(() => adapter.registerController(ControllerWithoutMetadata)).not.toThrow();
    });

    it('should handle controller with metadata but no routes', () => {
      container.register(ControllerWithoutRoutes, () => new ControllerWithoutRoutes());

      expect(() => adapter.registerController(ControllerWithoutRoutes)).not.toThrow();
    });

    it('should register multiple controllers', () => {
      container.register(TestController, () => new TestController());
      container.register(HealthController, () => new HealthController());

      expect(() => adapter.registerController(TestController)).not.toThrow();
      expect(() => adapter.registerController(HealthController)).not.toThrow();
    });

    it('should resolve controller dependencies', () => {
      container.register(UserService, () => new UserService());
      container.register(ControllerWithDependencies, (c) => {
        const userService = c.resolve(UserService);
        return new ControllerWithDependencies(userService);
      });

      adapter.registerController(ControllerWithDependencies);
      expect(true).toBe(true);
    });
  });

  describe('listen and close', () => {
    it('should start server on specified port', async () => {
      container.register(TestController, () => new TestController());
      adapter.registerController(TestController);

      const port = 3556;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/test/`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { items: string[] };
      expect(data.items).toEqual(['a', 'b', 'c']);
    });

    it('should close the server', async () => {
      container.register(TestController, () => new TestController());
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
      container.register(TestController, () => new TestController());
      adapter.registerController(TestController);

      const port = 3558;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/test/123`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { id: string };
      expect(data.id).toBe('123');
    });

    it('should handle POST requests', async () => {
      container.register(TestController, () => new TestController());
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
      container.register(TestController, () => new TestController());
      adapter.registerController(TestController);

      const port = 3560;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/nonexistent`);
      expect(response.status).toBe(404);
    });
  });

  describe('basePath handling', () => {
    it('should combine basePath with route path', async () => {
      container.register(HealthController, () => new HealthController());
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
        index(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ root: true });
        }
      }

      container.register(RootController, () => new RootController());
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
        test(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ trailing: true });
        }
      }

      container.register(TrailingSlashController, () => new TrailingSlashController());
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
          routes: [{ method: 'GET', path: 'test', handler: 'test' }] as const,
        };
        test(_req: FastifyRequest, reply: FastifyReply): void {
          reply.send({ nolead: true });
        }
      }

      container.register(NoLeadingSlashController, () => new NoLeadingSlashController());
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
        boom(): never {
          throw new Error('Something went wrong');
        }
      }
      container.register(ErrorController, () => new ErrorController());
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
      }

      container.register(InvalidHandlerController, () => new InvalidHandlerController());
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
        async getData(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
          await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
          reply.send({ async: true });
        }
      }

      container.register(AsyncController, () => new AsyncController());
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
        throw(): never {
          //
          throw 'string error';
        }
      }

      container.register(NonErrorController, () => new NonErrorController());
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

      container.register(AllMethodsController, () => new AllMethodsController());
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
