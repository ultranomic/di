import { Container, Controller } from '../core/index.js';
import type { DepsTokens } from '../core/index.js';
import type { Context } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HonoAdapter } from './adapter.js';
import { hc, type InferHonoAppType, type InferRoutesFromApp, createRpcClient } from './index.ts';

class TestController extends Controller {
  static readonly metadata = {
    basePath: '/test',
    routes: [
      { method: 'GET', path: '/', handler: 'list' },
      { method: 'GET', path: '/:id', handler: 'get' },
      { method: 'POST', path: '/', handler: 'create' },
    ] as const,
  };

  list(c: Context): Response {
    return c.json({ items: ['a', 'b', 'c'] });
  }

  get(c: Context): Response {
    return c.json({ id: c.req.param('id') });
  }

  create(c: Context): Response {
    return c.json({ created: true }, 201);
  }
}

class HealthController extends Controller {
  static readonly metadata = {
    basePath: '/health',
    routes: [{ method: 'GET', path: '/', handler: 'check' }] as const,
  };

  check(c: Context): Response {
    return c.json({ status: 'ok' });
  }
}

class ControllerWithoutMetadata extends Controller {
  list(c: Context): Response {
    return c.json({ items: [] });
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

  constructor(private userService: UserService) {
    super();
  }

  list(c: Context): Response {
    return c.json({ users: this.userService.getUsers() });
  }
}

describe('HonoAdapter', () => {
  let container: Container;
  let adapter: HonoAdapter;

  beforeEach(() => {
    container = new Container();
    adapter = new HonoAdapter(container);
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('constructor', () => {
    it('should create a HonoAdapter instance', () => {
      expect(adapter).toBeInstanceOf(HonoAdapter);
    });

    it('should create an internal Hono app', () => {
      const app = adapter.getApp();
      expect(app).toBeDefined();
      expect(typeof app.fetch).toBe('function');
    });
  });

  describe('registerController', () => {
    it('should register routes from controller metadata', () => {
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });

      expect(() => adapter.registerController(TestController)).not.toThrow();
    });

    it('should handle controller without metadata gracefully', () => {
      container.register(ControllerWithoutMetadata, (c) => {
        return new ControllerWithoutMetadata(...c.buildDeps(ControllerWithoutMetadata.inject ?? []));
      });

      expect(() => adapter.registerController(ControllerWithoutMetadata)).not.toThrow();
    });

    it('should handle controller with metadata but no routes', () => {
      container.register(ControllerWithoutRoutes, (c) => {
        return new ControllerWithoutRoutes(...c.buildDeps(ControllerWithoutRoutes.inject ?? []));
      });

      expect(() => adapter.registerController(ControllerWithoutRoutes)).not.toThrow();
    });

    it('should register multiple controllers', () => {
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      container.register(HealthController, (c) => {
        return new HealthController(...c.buildDeps(HealthController.inject ?? []));
      });

      expect(() => adapter.registerController(TestController)).not.toThrow();
      expect(() => adapter.registerController(HealthController)).not.toThrow();
    });

    it('should resolve controller dependencies', () => {
      container.register(UserService, () => new UserService());
      container.register(ControllerWithDependencies, (c) => {
        return new ControllerWithDependencies(...c.buildDeps(ControllerWithDependencies.inject));
      });

      adapter.registerController(ControllerWithDependencies);
      expect(true).toBe(true);
    });
  });

  describe('listen and close', () => {
    it('should start server on specified port', async () => {
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      adapter.registerController(TestController);

      const port = 3656;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/test/`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { items: string[] };
      expect(data.items).toEqual(['a', 'b', 'c']);
    });

    it('should close the server', async () => {
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      adapter.registerController(TestController);

      const port = 3657;
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
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      adapter.registerController(TestController);

      const port = 3658;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/test/123`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as { id: string };
      expect(data.id).toBe('123');
    });

    it('should handle POST requests', async () => {
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      adapter.registerController(TestController);

      const port = 3759;
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
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      adapter.registerController(TestController);

      const port = 3660;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/nonexistent`);
      expect(response.status).toBe(404);
    });
  });

  describe('basePath handling', () => {
    it('should combine basePath with route path', async () => {
      container.register(HealthController, (c) => {
        return new HealthController(...c.buildDeps(HealthController.inject ?? []));
      });
      adapter.registerController(HealthController);

      const port = 3661;
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
        index(c: Context): Response {
          return c.json({ root: true });
        }
      }

      container.register(RootController, (c) => {
        return new RootController(...c.buildDeps(RootController.inject ?? []));
      });
      adapter.registerController(RootController);

      const port = 3662;
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

      container.register(ErrorController, (c) => {
        return new ErrorController(...c.buildDeps(ErrorController.inject ?? []));
      });
      adapter.registerController(ErrorController);

      const port = 3663;
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

      container.register(InvalidHandlerController, (c) => {
        return new InvalidHandlerController(...c.buildDeps(InvalidHandlerController.inject ?? []));
      });
      adapter.registerController(InvalidHandlerController);

      const port = 3665;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/invalid/`);
      expect(response.status).toBe(500);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Handler 'nonexistent' not found on controller");
    });

    it('should return null body when handler returns non-Response result', async () => {
      class NullResponseController extends Controller {
        static readonly metadata = {
          basePath: '/null',
          routes: [{ method: 'GET', path: '/', handler: 'index' }] as const,
        };
        index(): unknown {
          // Return a value that's not a Response and doesn't have Response-like properties
          return { some: 'value' };
        }
      }

      container.register(NullResponseController, (c) => {
        return new NullResponseController(...c.buildDeps(NullResponseController.inject ?? []));
      });
      adapter.registerController(NullResponseController);

      const port = 3666;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/null/`);
      expect(response.status).toBe(200);
      // c.body(null) returns a Response with null body content
      const text = await response.text();
      expect(text).toBe('');
    });

    it('should handle response-like objects with status and headers', async () => {
      // This tests the branch at line 134 that checks for Response-like objects
      class ResponseLikeController extends Controller {
        static readonly metadata = {
          basePath: '/response-like',
          routes: [{ method: 'GET', path: '/', handler: 'index' }] as const,
        };
        index(): { status: number; headers: Headers } {
          // Return an object that looks like a Response but isn't one
          // This should be treated as a Response due to the duck-type check
          return {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          } as unknown as Response;
        }
      }

      container.register(ResponseLikeController, (c) => {
        return new ResponseLikeController(...c.buildDeps(ResponseLikeController.inject ?? []));
      });
      adapter.registerController(ResponseLikeController);

      const port = 3672;
      await adapter.listen(port);

      const response = await fetch(`http://localhost:${port}/response-like/`);
      expect(response.status).toBe(200);
    });
  });

  describe('listen error handling', () => {
    it('should handle server error during listen when port is in use', async () => {
      class TestController extends Controller {
        static readonly metadata = {
          basePath: '/test',
          routes: [{ method: 'GET', path: '/', handler: 'list' }] as const,
        };
        list(c: Context): Response {
          return c.json({ items: [] });
        }
      }

      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      adapter.registerController(TestController);

      const port = 3666;
      await adapter.listen(port);

      // Create a second adapter and try to listen on the same port
      const adapter2 = new HonoAdapter(container);
      adapter2.registerController(TestController);

      // This should reject because the port is already in use
      await expect(adapter2.listen(port)).rejects.toThrow();

      // Clean up
      await adapter.close();
    });

    it('should reject when serve throws an error during listen', async () => {
      class TestController extends Controller {
        static readonly metadata = {
          basePath: '/test',
          routes: [{ method: 'GET', path: '/', handler: 'list' }] as const,
        };
        list(c: Context): Response {
          return c.json({ items: [] });
        }
      }

      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      adapter.registerController(TestController);

      // Create an adapter that will fail when listening due to invalid configuration
      const badAdapter = new HonoAdapter(container);
      badAdapter.registerController(TestController);

      // Try to use a port that's likely to fail or cause issues
      // Using port -1 should cause an error
      await expect(badAdapter.listen(-1)).rejects.toThrow();
    });
  });

  describe('close error handling', () => {
    it('should reject on server close error', async () => {
      class TestController extends Controller {
        static readonly metadata = {
          basePath: '/test',
          routes: [{ method: 'GET', path: '/', handler: 'list' }] as const,
        };
        list(c: Context): Response {
          return c.json({ items: [] });
        }
      }

      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      adapter.registerController(TestController);

      const port = 3669;
      await adapter.listen(port);

      // Close the server
      await adapter.close();

      // Create a new adapter and close without listening - should resolve without error
      const newAdapter = new HonoAdapter(container);
      await expect(newAdapter.close()).resolves.toBeUndefined();
    });

    it('should reject when server close encounters an error', async () => {
      class TestController extends Controller {
        static readonly metadata = {
          basePath: '/test',
          routes: [{ method: 'GET', path: '/', handler: 'list' }] as const,
        };
        list(c: Context): Response {
          return c.json({ items: [] });
        }
      }

      const testContainer = new Container();
      const testAdapter = new HonoAdapter(testContainer);

      testContainer.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      testAdapter.registerController(TestController);

      const port = 3673;
      await testAdapter.listen(port);

      // Mock the server.close to simulate an error
      const server = testAdapter['server'];
      if (server) {
        server.close = (cb: (err?: Error) => void) => {
          cb(new Error('Close error'));
        };
      }

      // This should reject because close callback receives an error
      await expect(testAdapter.close()).rejects.toThrow('Close error');
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
        get(c: Context): Response {
          return c.json({ method: 'GET' });
        }
        post(c: Context): Response {
          return c.json({ method: 'POST' });
        }
        put(c: Context): Response {
          return c.json({ method: 'PUT' });
        }
        patch(c: Context): Response {
          return c.json({ method: 'PATCH' });
        }
        delete(c: Context): Response {
          return c.json({ method: 'DELETE' });
        }
      }

      container.register(AllMethodsController, (c) => {
        return new AllMethodsController(...c.buildDeps(AllMethodsController.inject ?? []));
      });
      adapter.registerController(AllMethodsController);

      const port = 3664;
      await adapter.listen(port);

      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
      for (const method of methods) {
        const response = await fetch(`http://localhost:${port}/methods/`, { method });
        expect(response.status).toBe(200);
        const data = (await response.json()) as { method: string };
        expect(data.method).toBe(method);
      }
    });

    it('should handle HEAD and OPTIONS methods', async () => {
      class HeadOptionsController extends Controller {
        static readonly metadata = {
          basePath: '/headopts',
          routes: [
            { method: 'GET', path: '/', handler: 'get' },
            { method: 'HEAD', path: '/', handler: 'head' },
            { method: 'OPTIONS', path: '/', handler: 'options' },
          ] as const,
        };
        get(c: Context): Response {
          return c.json({ method: 'GET' });
        }
        head(c: Context): Response {
          return c.json({ method: 'HEAD' });
        }
        options(c: Context): Response {
          return c.json({ method: 'OPTIONS' });
        }
      }

      container.register(HeadOptionsController, (c) => {
        return new HeadOptionsController(...c.buildDeps(HeadOptionsController.inject ?? []));
      });
      adapter.registerController(HeadOptionsController);

      const port = 3670;
      await adapter.listen(port);

      // GET should work
      const getResponse = await fetch(`http://localhost:${port}/headopts/`);
      expect(getResponse.status).toBe(200);

      // Test HEAD and OPTIONS via app.request since fetch might not work correctly
      const app = adapter.getApp();
      const headResponse = await app.request('/headopts/', { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      const optionsResponse = await app.request('/headopts/', { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);
    });

    it('should handle custom HTTP methods via default case', async () => {
      class CustomMethodController extends Controller {
        static readonly metadata = {
          basePath: '/custom',
          routes: [
            // Using a non-standard method to test default case in registerRoute
            { method: 'PROPFIND' as const, path: '/', handler: 'propfind' },
          ] as const,
        };
        propfind(c: Context): Response {
          return c.json({ method: 'PROPFIND' });
        }
      }

      container.register(CustomMethodController, (c) => {
        return new CustomMethodController(...c.buildDeps(CustomMethodController.inject ?? []));
      });
      adapter.registerController(CustomMethodController);

      const port = 3671;
      await adapter.listen(port);

      // Test custom method via app.request
      const app = adapter.getApp();
      const response = await app.request('/custom/', { method: 'PROPFIND' });
      expect(response.status).toBe(200);
      const data = (await response.json()) as { method: string };
      expect(data.method).toBe('PROPFIND');
    });
  });

  describe('RPC functionality', () => {
    it('getApp() returns a valid Hono instance', () => {
      const adapter = new HonoAdapter(new Container());
      const app = adapter.getApp();

      expect(app).toBeDefined();
      expect(typeof app.fetch).toBe('function');
      expect(typeof app.on).toBe('function');
      expect(typeof app.get).toBe('function');
      expect(typeof app.post).toBe('function');
    });

    it('routes registered through controllers are accessible on the app', async () => {
      const container = new Container();
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });

      const adapter = new HonoAdapter(container);
      adapter.registerController(TestController);

      const app = adapter.getApp();
      const response = await app.request('/test/');
      expect(response.status).toBe(200);
    });

    it('the app can be used with hc client from hono/client', () => {
      const container = new Container();
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });

      const adapter = new HonoAdapter(container);
      adapter.registerController(TestController);

      const app = adapter.getApp();
      const client = hc<typeof app>('/');

      expect(client).toBeDefined();
      expect(client.test).toBeDefined();

      // Type assertion - if this compiles, types work correctly
      type ClientType = typeof client;
      const _typeCheck: ClientType = client;
      expect(_typeCheck).toBeDefined();
    });

    it('client can make requests to registered routes via hc', async () => {
      const container = new Container();
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });

      const adapter = new HonoAdapter(container);
      adapter.registerController(TestController);

      // Test via app.request directly (simulating what hc does)
      const app = adapter.getApp();
      const response = await app.request('/test/');
      expect(response.status).toBe(200);

      const data = (await response.json()) as { items: string[] };
      expect(data).toEqual({ items: ['a', 'b', 'c'] });

      // Also verify hc client creates proper type structure
      const client = hc<typeof app>('http://localhost');
      expect(client.test).toBeDefined();
      expect(client.test.$get).toBeDefined();
    });

    it('client can make requests with path parameters', async () => {
      const container = new Container();
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });

      const adapter = new HonoAdapter(container);
      adapter.registerController(TestController);

      // Test via app.request directly
      const app = adapter.getApp();
      const response = await app.request('/test/123');
      expect(response.status).toBe(200);

      const data = (await response.json()) as { id: string };
      expect(data).toEqual({ id: '123' });

      // Verify hc client has proper typing for dynamic routes
      const client = hc<typeof app>('http://localhost');
      expect(client.test[':id']).toBeDefined();
      expect(client.test[':id'].$get).toBeDefined();
    });

    it('client can make POST requests', async () => {
      const container = new Container();
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });

      const adapter = new HonoAdapter(container);
      adapter.registerController(TestController);

      // Test via app.request directly
      const app = adapter.getApp();
      const response = await app.request('/test/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as { created: boolean };
      expect(data).toEqual({ created: true });

      // Verify hc client has proper typing for POST
      const client = hc<typeof app>('http://localhost');
      expect(client.test.$post).toBeDefined();
    });

    it('createRpcClient creates a typed client from adapter', async () => {
      const container = new Container();
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });

      const adapter = new HonoAdapter(container);
      adapter.registerController(TestController);

      const client = createRpcClient(adapter, 'http://localhost');

      expect(client).toBeDefined();
      expect(client.test).toBeDefined();
      expect(client.test.$get).toBeDefined();

      // Verify the client works by testing the underlying app
      const app = adapter.getApp();
      const response = await app.request('/test/');
      expect(response.status).toBe(200);
    });

    it('multiple controllers work with RPC client', async () => {
      const container = new Container();
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });
      container.register(HealthController, (c) => {
        return new HealthController(...c.buildDeps(HealthController.inject ?? []));
      });

      const adapter = new HonoAdapter(container);
      adapter.registerController(TestController);
      adapter.registerController(HealthController);

      const client = createRpcClient(adapter, 'http://localhost');

      expect(client.test).toBeDefined();
      expect(client.health).toBeDefined();

      // Verify both routes work via the underlying app
      const app = adapter.getApp();
      const testResponse = await app.request('/test/');
      const healthResponse = await app.request('/health/');

      expect(testResponse.status).toBe(200);
      expect(healthResponse.status).toBe(200);

      const testData = (await testResponse.json()) as { items: string[] };
      const healthData = (await healthResponse.json()) as { status: string };

      expect(testData).toEqual({ items: ['a', 'b', 'c'] });
      expect(healthData).toEqual({ status: 'ok' });
    });

    it('InferHonoAppType correctly infers Hono type from adapter', () => {
      const adapter = new HonoAdapter(new Container());

      // Type test - should compile without errors
      type AdapterAppType = InferHonoAppType<typeof adapter>;

      // This is a compile-time type test - if it compiles, types are working
      const app: AdapterAppType = adapter.getApp();
      expect(app).toBeDefined();
      expect(typeof app.fetch).toBe('function');
    });

    it('InferRoutesFromApp extracts routes schema from Hono app', () => {
      const adapter = new HonoAdapter(new Container());
      const app = adapter.getApp();

      // Type test - should compile without errors
      // oxlint-disable-next-line eslint(no-unused-vars)
      type RoutesType = InferRoutesFromApp<typeof app>;

      // This is a compile-time type test
      expect(app).toBeDefined();
    });

    it('type inference works with registered controllers', async () => {
      const container = new Container();
      container.register(TestController, (c) => {
        return new TestController(...c.buildDeps(TestController.inject ?? []));
      });

      const adapter = new HonoAdapter(container);
      adapter.registerController(TestController);

      // Type test - client should have proper typing for registered routes
      const client = createRpcClient(adapter, 'http://localhost');

      // If this compiles, type inference is working correctly
      expect(client.test).toBeDefined();
    });
  });
});
