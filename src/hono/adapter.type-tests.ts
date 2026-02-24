/**
 * Type-only tests for Hono RPC functionality
 *
 * This file contains TypeScript type tests that verify:
 * - HonoAdapter works with hc client
 * - Type inference works correctly
 * - RPC types are properly exported
 *
 * These are compile-time tests - if this file compiles without errors,
 * the type system is working correctly.
 */

import { Container, Controller } from '../core/index.js';
import type { Context } from 'hono';
import { HonoAdapter } from './adapter.ts';
import {
  hc,
  createRpcClient,
  createClientFromApp,
  type InferHonoAppType,
  type InferRoutesFromApp,
  type RpcClient,
  type AppClient,
} from './index.ts';

// Test controllers
class UserController extends Controller {
  static readonly metadata = {
    basePath: '/users',
    routes: [
      { method: 'GET', path: '/', handler: 'list' },
      { method: 'GET', path: '/:id', handler: 'get' },
      { method: 'POST', path: '/', handler: 'create' },
    ] as const,
  };
  static readonly inject = {} as const;
  constructor(_deps: typeof UserController.inject) {
    super();
  }
  list(c: Context): Response {
    return c.json({ users: [] });
  }
  get(c: Context): Response {
    return c.json({ id: c.req.param('id') });
  }
  create(c: Context): Response {
    return c.json({ created: true }, 201);
  }
}

// Test 1: InferHonoAppType should infer Hono type from adapter
function testInferHonoAppType() {
  const container = new Container();
  const adapter = new HonoAdapter(container);

  type AdapterAppType = InferHonoAppType<typeof adapter>;

  // This should compile - adapter.getApp() returns the inferred type
  const app: AdapterAppType = adapter.getApp();

  // Verify the app has expected methods
  const _fetch: typeof app.fetch = app.fetch;
  const _on: typeof app.on = app.on;

  return { app, _fetch, _on };
}

// Test 2: InferRoutesFromApp should extract routes schema
function testInferRoutesFromApp() {
  const container = new Container();
  const adapter = new HonoAdapter(container);
  const app = adapter.getApp();

  type RoutesType = InferRoutesFromApp<typeof app>;

  // RoutesType should be the schema type from Hono
  // If this compiles, the type is correctly inferred
  const _routes: RoutesType = {} as RoutesType;

  return _routes;
}

// Test 3: createRpcClient should return properly typed client
function testCreateRpcClient() {
  const container = new Container();
  container.register(UserController, (c) => {
    return new UserController(c.buildDeps(UserController.inject));
  });

  const adapter = new HonoAdapter(container);
  adapter.registerController(UserController);

  const client = createRpcClient(adapter, 'http://localhost');

  // Client should have proper typing for registered routes
  // If these access patterns compile, types are working
  const _usersRoute = client.users;
  const _listMethod = client.users.$get;
  const _getMethod = client.users[':id'].$get;
  const _postMethod = client.users.$post;

  return { client, _usersRoute, _listMethod, _getMethod, _postMethod };
}

// Test 4: createClientFromApp should return properly typed client
function testCreateClientFromApp() {
  const container = new Container();
  container.register(UserController, (c) => {
    return new UserController(c.buildDeps(UserController.inject));
  });

  const adapter = new HonoAdapter(container);
  adapter.registerController(UserController);
  const app = adapter.getApp();

  const client = createClientFromApp(app, 'http://localhost');

  // Client should have proper typing for registered routes
  const _usersRoute = client.users;
  const _listMethod = client.users.$get;

  return { client, _usersRoute, _listMethod };
}

// Test 5: hc should work with HonoAdapter's app
function testHcWithAdapter() {
  const container = new Container();
  container.register(UserController, (c) => {
    return new UserController(c.buildDeps(UserController.inject));
  });

  const adapter = new HonoAdapter(container);
  adapter.registerController(UserController);
  const app = adapter.getApp();

  // hc should work with the app
  const client = hc<typeof app>('http://localhost');

  const _usersRoute = client.users;
  const _listMethod = client.users.$get;

  return { client, _usersRoute, _listMethod };
}

// Test 6: RpcClient type should work correctly
function testRpcClientType() {
  const container = new Container();
  const adapter = new HonoAdapter(container);

  type MyRpcClient = RpcClient<typeof adapter>;

  // If this compiles, the RpcClient type works
  const _clientType: MyRpcClient = null as unknown as MyRpcClient;

  return _clientType;
}

// Test 7: AppClient type should work correctly
function testAppClientType() {
  const container = new Container();
  const adapter = new HonoAdapter(container);
  const app = adapter.getApp();

  type MyAppClient = AppClient<typeof app>;

  // If this compiles, the AppClient type works
  const _clientType: MyAppClient = null as unknown as MyAppClient;

  return _clientType;
}

// Test 8: Multiple controllers should be represented in types
function testMultipleControllers() {
  class PostController extends Controller {
    static readonly metadata = {
      basePath: '/posts',
      routes: [{ method: 'GET', path: '/', handler: 'list' }] as const,
    };
    static readonly inject = {} as const;
    constructor(_deps: typeof PostController.inject) {
      super();
    }
    list(c: Context): Response {
      return c.json({ posts: [] });
    }
  }

  const container = new Container();
  container.register(UserController, (c) => {
    return new UserController(c.buildDeps(UserController.inject));
  });
  container.register(PostController, (c) => {
    return new PostController(c.buildDeps(PostController.inject));
  });

  const adapter = new HonoAdapter(container);
  adapter.registerController(UserController);
  adapter.registerController(PostController);

  const client = createRpcClient(adapter, 'http://localhost');

  // Both controllers should be available in the client
  const _users = client.users;
  const _posts = client.posts;

  return { client, _users, _posts };
}

// Test 9: Type exports should be available from package index
function testPackageExports() {
  // Verify all types are exported from the main index
  type _1 = InferHonoAppType<HonoAdapter>;
  type _2 = InferRoutesFromApp<HonoAdapter>;

  return true;
}

// Export a dummy value to make this a module (required for type-only tests)
export const typeTests = {
  testInferHonoAppType,
  testInferRoutesFromApp,
  testCreateRpcClient,
  testCreateClientFromApp,
  testHcWithAdapter,
  testRpcClientType,
  testAppClientType,
  testMultipleControllers,
  testPackageExports,
};
