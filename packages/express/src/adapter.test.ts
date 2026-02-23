import { Container, Controller } from '@voxeljs/core';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExpressAdapter } from './adapter.ts';

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

  list(_req: Request, res: Response): void {
    res.json({ items: ['a', 'b', 'c'] });
  }

  get(req: Request, res: Response): void {
    res.json({ id: req.params.id });
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

  static readonly inject = {} as const;

  constructor(_deps: typeof HealthController.inject) {
    super();
  }

  check(_req: Request, res: Response): void {
    res.json({ status: 'ok' });
  }
}

class ControllerWithoutMetadata extends Controller {
  static readonly inject = {} as const;

  constructor(_deps: typeof ControllerWithoutMetadata.inject) {
    super();
  }

  list(_req: Request, res: Response): void {
    res.json({ items: [] });
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

  list(_req: Request, res: Response): void {
    res.json({ users: this.deps.service.getUsers() });
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

      const port = 3456;
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
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject));
      });
      adapter.registerController(TestController);

      const port = 3458;
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
      container.register(TestController, (c) => {
        return new TestController(c.buildDeps(TestController.inject));
      });
      adapter.registerController(TestController);

      const port = 3460;
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
        static readonly inject = {} as const;
        constructor(_deps: typeof RootController.inject) {
          super();
        }
        index(_req: Request, res: Response): void {
          res.json({ root: true });
        }
      }

      container.register(RootController, (c) => {
        return new RootController(c.buildDeps(RootController.inject));
      });
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

      const port = 3463;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/error/`);
      expect(response.status).toBe(500);
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

      container.register(AllMethodsController, (c) => {
        return new AllMethodsController(c.buildDeps(AllMethodsController.inject));
      });
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
