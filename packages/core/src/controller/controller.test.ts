import { describe, expect, it } from 'vitest';
import type { ControllerRoute } from '../types/controller.ts';
import type { ControllerMetadata } from './controller.ts';
import { Controller } from './controller.ts';
import type { ControllerConstructor, RouteInfo } from './interfaces.ts';

describe('Controller', () => {
  describe('static metadata', () => {
    it('should allow defining static metadata on a controller', () => {
      class TestController extends Controller {
        static readonly metadata: ControllerMetadata = {
          basePath: '/test',
          routes: [],
        };
      }

      expect(TestController.metadata).toBeDefined();
      expect(TestController.metadata?.basePath).toBe('/test');
      expect(TestController.metadata?.routes).toEqual([]);
    });

    it('should allow basePath in metadata', () => {
      class UserController extends Controller {
        static readonly metadata: ControllerMetadata = {
          basePath: '/users',
        };
      }

      expect(UserController.metadata?.basePath).toBe('/users');
    });

    it('should allow routes in metadata', () => {
      class UserController extends Controller {
        static readonly metadata: ControllerMetadata = {
          routes: [
            { method: 'GET', path: '/', handler: 'list' },
            { method: 'GET', path: '/:id', handler: 'get' },
            { method: 'POST', path: '/', handler: 'create' },
          ] as const satisfies ControllerRoute<UserController>[],
        };

        async list() {
          return [];
        }

        async get() {
          return null;
        }

        async create() {
          return {};
        }
      }

      expect(UserController.metadata?.routes).toHaveLength(3);
      expect(UserController.metadata?.routes?.[0]).toEqual({
        method: 'GET',
        path: '/',
        handler: 'list',
      });
    });

    it('should allow empty metadata', () => {
      class EmptyController extends Controller {}

      expect(EmptyController.metadata).toBeUndefined();
    });

    it('should allow metadata with only basePath', () => {
      class HealthController extends Controller {
        static readonly metadata: ControllerMetadata = {
          basePath: '/health',
        };
      }

      expect(HealthController.metadata?.basePath).toBe('/health');
      expect(HealthController.metadata?.routes).toBeUndefined();
    });

    it('should allow metadata with only routes', () => {
      class ApiRootController extends Controller {
        static readonly metadata: ControllerMetadata = {
          routes: [
            { method: 'GET', path: '/', handler: 'index' },
          ] as const satisfies ControllerRoute<ApiRootController>[],
        };

        async index() {
          return { status: 'ok' };
        }
      }

      expect(ApiRootController.metadata?.basePath).toBeUndefined();
      expect(ApiRootController.metadata?.routes).toHaveLength(1);
    });
  });

  describe('ControllerConstructor type', () => {
    it('should work with ControllerConstructor type', () => {
      class TestController extends Controller {
        static readonly metadata: ControllerMetadata = {
          basePath: '/test',
        };
      }

      const ControllerClass: ControllerConstructor = TestController;
      expect(ControllerClass.metadata?.basePath).toBe('/test');
      expect(() => new ControllerClass()).not.toThrow();
    });

    it('should allow instantiation via ControllerConstructor', () => {
      class TestController extends Controller {}

      const ControllerClass: ControllerConstructor = TestController;
      const instance = new ControllerClass();
      expect(instance).toBeInstanceOf(Controller);
      expect(instance).toBeInstanceOf(TestController);
    });
  });

  describe('RouteInfo type', () => {
    it('should allow creating RouteInfo from controller metadata', () => {
      class UserController extends Controller {
        static readonly metadata: ControllerMetadata = {
          basePath: '/users',
          routes: [
            { method: 'GET', path: '/', handler: 'list' },
            { method: 'GET', path: '/:id', handler: 'get' },
          ] as const satisfies ControllerRoute<UserController>[],
        };
      }

      const routeInfoList: RouteInfo = {
        method: 'GET',
        path: '/users/',
        handler: 'list',
        controller: UserController,
      };

      const routeInfoGet: RouteInfo = {
        method: 'GET',
        path: '/users/:id',
        handler: 'get',
        controller: UserController,
      };

      expect(routeInfoList.method).toBe('GET');
      expect(routeInfoList.path).toBe('/users/');
      expect(routeInfoList.handler).toBe('list');
      expect(routeInfoList.controller).toBe(UserController);

      expect(routeInfoGet.method).toBe('GET');
      expect(routeInfoGet.path).toBe('/users/:id');
      expect(routeInfoGet.handler).toBe('get');
      expect(routeInfoGet.controller).toBe(UserController);
    });
  });

  describe('inheritance', () => {
    it('should allow extending Controller', () => {
      class BaseController extends Controller {
        static readonly metadata: ControllerMetadata = {
          basePath: '/api',
        };
      }

      class UserController extends BaseController {
        static readonly metadata: ControllerMetadata = {
          basePath: '/api/users',
          routes: [{ method: 'GET', path: '/', handler: 'list' }] as const satisfies ControllerRoute<UserController>[],
        };

        async list() {
          return [];
        }
      }

      expect(BaseController.metadata?.basePath).toBe('/api');
      expect(UserController.metadata?.basePath).toBe('/api/users');
    });

    it('should allow controllers without metadata', () => {
      class SimpleController extends Controller {}

      expect(SimpleController.metadata).toBeUndefined();
      const instance = new SimpleController();
      expect(instance).toBeInstanceOf(Controller);
    });
  });

  describe('HTTP methods', () => {
    it('should support all HTTP methods', () => {
      class FullController extends Controller {
        static readonly metadata: ControllerMetadata = {
          routes: [
            { method: 'GET', path: '/', handler: 'get' },
            { method: 'POST', path: '/', handler: 'post' },
            { method: 'PUT', path: '/:id', handler: 'put' },
            { method: 'PATCH', path: '/:id', handler: 'patch' },
            { method: 'DELETE', path: '/:id', handler: 'delete' },
            { method: 'HEAD', path: '/', handler: 'head' },
            { method: 'OPTIONS', path: '/', handler: 'options' },
          ] as const satisfies ControllerRoute<FullController>[],
        };

        async get() {}
        async post() {}
        async put() {}
        async patch() {}
        async delete() {}
        async head() {}
        async options() {}
      }

      const routes = FullController.metadata?.routes ?? [];
      expect(routes).toHaveLength(7);
      expect(routes.map((r) => r.method)).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
    });
  });

  describe('path patterns', () => {
    it('should support simple paths', () => {
      class SimplePathController extends Controller {
        static readonly metadata: ControllerMetadata = {
          routes: [
            { method: 'GET', path: '/health', handler: 'health' },
            { method: 'GET', path: '/status', handler: 'status' },
          ] as const satisfies ControllerRoute<SimplePathController>[],
        };

        async health() {}
        async status() {}
      }

      const routes = SimplePathController.metadata?.routes ?? [];
      expect(routes[0].path).toBe('/health');
      expect(routes[1].path).toBe('/status');
    });

    it('should support path parameters', () => {
      class ParamsController extends Controller {
        static readonly metadata: ControllerMetadata = {
          routes: [
            { method: 'GET', path: '/users/:id', handler: 'getUser' },
            { method: 'GET', path: '/users/:userId/posts/:postId', handler: 'getPost' },
          ] as const satisfies ControllerRoute<ParamsController>[],
        };

        async getUser() {}
        async getPost() {}
      }

      const routes = ParamsController.metadata?.routes ?? [];
      expect(routes[0].path).toBe('/users/:id');
      expect(routes[1].path).toBe('/users/:userId/posts/:postId');
    });
  });
});
