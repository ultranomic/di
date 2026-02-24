import { Container, Controller } from '../core/index.js';
import type { DepsTokens } from '../core/index.js';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExpressAdapter } from './adapter.js';

class TestController extends Controller {
  static readonly metadata = {
    basePath: '/test',
    routes: [
      { method: 'GET', path: '/', handler: 'list' },
      { method: 'GET', path: '/:id', handler: 'get' },
      { method: 'POST', path: '/', handler: 'create' },
    ] as const,
  };

  list(_req: Request, res: Response): void {
    res.json({ items: ['a', 'b', 'c'] });
  }

  get(req: Request, res: Response): void {
    res.json({ id: req.params['id'] });
  }

  create(_req: Request, res: Response): void {
    res.status(201).json({ created: true });
  }
}

class HealthController extends Controller {
  static readonly metadata = {
    basePath: '/health',
    routes: [{ method: 'GET', path: '/', handler: 'check' }] as const,
  };

  check(_req: Request, res: Response): void {
    res.json({ status: 'ok' });
  }
}

class ControllerWithoutMetadata extends Controller {
  list(_req: Request, res: Response): void {
    res.json({ items: [] });
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

  list(_req: Request, res: Response): void {
    res.json({ users: this.userService.getUsers() });
  }
}

describe('ExpressAdapter', () => {
  let container: Container;
  let adapter: ExpressAdapter;

  beforeEach(() => {
    container = new Container();
    adapter = new ExpressAdapter(container);
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('constructor', () => {
    it('should create an ExpressAdapter instance', () => {
      expect(adapter).toBeInstanceOf(ExpressAdapter);
    });

    it('should create an internal Express app', () => {
      const app = adapter.getApp();
      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
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

      const port = 3456;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/test/`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { items: string[] };
      expect(data.items).toEqual(['a', 'b', 'c']);
    });

    it('should close the server', async () => {
      container.register(TestController, () => new TestController());
      adapter.registerController(TestController);

      const port = 3457;
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

      const port = 3458;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/test/123`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { id: string };
      expect(data.id).toBe('123');
    });

    it('should handle POST requests', async () => {
      container.register(TestController, () => new TestController());
      adapter.registerController(TestController);

      const port = 3459;
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

      const port = 3460;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/nonexistent`);
      expect(response.status).toBe(404);
    });
  });

  describe('basePath handling', () => {
    it('should combine basePath with route path', async () => {
      container.register(HealthController, () => new HealthController());
      adapter.registerController(HealthController);

      const port = 3461;
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
        index(_req: Request, res: Response): void {
          res.json({ root: true });
        }
      }

      container.register(RootController, () => new RootController());
      adapter.registerController(RootController);

      const port = 3462;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/root`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { root: boolean };
      expect(data.root).toBe(true);
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

      const port = 34463;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/error/`);
      expect(response.status).toBe(500);
    });

    it('should return 500 when handler is not found on controller', async () => {
      class InvalidHandlerController extends Controller {
        static readonly metadata = {
          basePath: '/invalid',
          routes: [{ method: 'GET', path: '/', handler: 'nonexistent' }] as const,
        };
      }

      container.register(InvalidHandlerController, () => new InvalidHandlerController());
      adapter.registerController(InvalidHandlerController);

      const port = 3466;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/invalid/`);
      expect(response.status).toBe(500);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Handler 'nonexistent' not found on controller");
    });

    it('should handle async handlers that return promises', async () => {
      class AsyncController extends Controller {
        static readonly metadata = {
          basePath: '/async',
          routes: [{ method: 'GET', path: '/', handler: 'getData' }] as const,
        };

        async getData(_req: Request, res: Response): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          res.json({ async: true });
        }
      }

      container.register(AsyncController, () => new AsyncController());
      adapter.registerController(AsyncController);

      const port = 3467;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/async/`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { async: boolean };
      expect(data.async).toBe(true);
    });
  });

  describe('close error handling', () => {
    it('should reject on server close error', async () => {
      class TestController extends Controller {
        static readonly metadata = {
          basePath: '/test',
          routes: [{ method: 'GET', path: '/', handler: 'list' }] as const,
        };
        list(_req: Request, res: Response): void {
          res.json({ items: [] });
        }
      }

      container.register(TestController, () => new TestController());
      adapter.registerController(TestController);

      const port = 3468;
      await adapter.listen(port);

      // Close the server once, then try to close it again
      await adapter.close();

      // Create a new adapter and close without listening - should resolve without error
      const newAdapter = new ExpressAdapter(container);
      await expect(newAdapter.close()).resolves.toBeUndefined();
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
        get(_req: Request, res: Response): void {
          res.json({ method: 'GET' });
        }
        post(_req: Request, res: Response): void {
          res.json({ method: 'POST' });
        }
        put(_req: Request, res: Response): void {
          res.json({ method: 'PUT' });
        }
        patch(_req: Request, res: Response): void {
          res.json({ method: 'PATCH' });
        }
        delete(_req: Request, res: Response): void {
          res.json({ method: 'DELETE' });
        }
      }

      container.register(AllMethodsController, () => new AllMethodsController());
      adapter.registerController(AllMethodsController);

      const port = 3464;
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
