import { describe, expect, it } from 'vitest';
import type { ControllerRoute } from '../types/controller.ts';
import type { ControllerMetadata } from './controller.ts';
import { Controller } from './controller.ts';
import type { ControllerConstructor, RouteInfo } from './interfaces.ts';
import type { DepsTokens } from '../types/deps.ts';

describe('Controller base class coverage', () => {
  it('should have undefined inject property on base Controller class', () => {
    // Access the base Controller class's inject property directly
    expect(Controller.inject).toBeUndefined();
  });

  it('should have undefined metadata property on base Controller class', () => {
    // Access the base Controller class's metadata property directly
    expect(Controller.metadata).toBeUndefined();
  });
});

describe('Controller', () => {
  describe('static metadata', () => {
    it('should allow defining static metadata on a controller', () => {
      class TestController extends Controller {
        static readonly metadata = {
          basePath: '/test',
          routes: [],
        } as const satisfies ControllerMetadata;
      }

      expect(TestController.metadata).toBeDefined();
      expect(TestController.metadata?.basePath).toBe('/test');
      expect(TestController.metadata?.routes).toEqual([]);
    });

    it('should allow basePath in metadata', () => {
      class UserController extends Controller {
        static readonly metadata = {
          basePath: '/users',
        } as const satisfies ControllerMetadata;
      }

      expect(UserController.metadata?.basePath).toBe('/users');
    });

    it('should allow routes in metadata', () => {
      class UserController extends Controller {
        static readonly metadata = {
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
        static readonly metadata = {
          basePath: '/health',
        } as const satisfies ControllerMetadata;
      }

      expect(HealthController.metadata?.basePath).toBe('/health');
      expect(HealthController.metadata?.routes).toBeUndefined();
    });

    it('should allow metadata with only routes', () => {
      class ApiRootController extends Controller {
        static readonly metadata = {
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
        static readonly metadata = {
          basePath: '/test',
        } as const satisfies ControllerMetadata;
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
        static readonly metadata = {
          basePath: '/users',
          routes: [
            { method: 'GET', path: '/', handler: 'list' },
            { method: 'GET', path: '/:id', handler: 'get' },
          ] as const,
        } as const satisfies ControllerMetadata;

        list() {}
        get() {}
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
        static readonly metadata = {
          basePath: '/api',
        } as const satisfies ControllerMetadata;
      }

      class UserController extends BaseController {
        static readonly metadata = {
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
        static readonly metadata = {
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
        static readonly metadata = {
          routes: [
            { method: 'GET', path: '/health', handler: 'health' },
            { method: 'GET', path: '/status', handler: 'status' },
          ] as const satisfies ControllerRoute<SimplePathController>[],
        };

        async health() {}
        async status() {}
      }

      const routes = SimplePathController.metadata?.routes ?? [];
      expect(routes[0]?.path).toBe('/health');
      expect(routes[1]?.path).toBe('/status');
    });

    it('should support path parameters', () => {
      class ParamsController extends Controller {
        static readonly metadata = {
          routes: [
            { method: 'GET', path: '/users/:id', handler: 'getUser' },
            { method: 'GET', path: '/users/:userId/posts/:postId', handler: 'getPost' },
          ] as const satisfies ControllerRoute<ParamsController>[],
        };

        async getUser() {}
        async getPost() {}
      }

      const routes = ParamsController.metadata?.routes ?? [];
      expect(routes[0]?.path).toBe('/users/:id');
      expect(routes[1]?.path).toBe('/users/:userId/posts/:postId');
    });
  });

  describe('new inject pattern', () => {
    it('should support the new array-based inject pattern with DepsTokens', () => {
      class Logger {
        log(msg: string) {
          return `logged: ${msg}`;
        }
      }

      class UserService {
        findAll() {
          return [{ id: '1', name: 'John' }];
        }
      }

      class UserController extends Controller {
        static readonly inject: DepsTokens<typeof this> = [Logger, UserService];

        static readonly metadata = {
          basePath: '/users',
          routes: [{ method: 'GET', path: '/', handler: 'list' }] as const satisfies ControllerRoute<UserController>[],
        };

        logger: Logger;
        users: UserService;
        constructor(logger: Logger, users: UserService) {
          super();
          this.logger = logger;
          this.users = users;
        }

        async list() {
          this.logger.log('Fetching users');
          return this.users.findAll();
        }
      }

      const logger = new Logger();
      const users = new UserService();
      const controller = new UserController(logger, users);

      expect(controller).toBeInstanceOf(Controller);
      expect(controller.logger).toBe(logger);
      expect(controller.users).toBe(users);
      expect(controller.logger.log('test')).toBe('logged: test');
    });

    it('should allow controllers with a single dependency', () => {
      class Database {
        query(sql: string) {
          return `executing: ${sql}`;
        }
      }

      class DataController extends Controller {
        static readonly inject: DepsTokens<typeof this> = [Database];

        static readonly metadata = {
          basePath: '/data',
          routes: [{ method: 'GET', path: '/', handler: 'query' }] as const satisfies ControllerRoute<DataController>[],
        };

        db: Database;
        constructor(db: Database) {
          super();
          this.db = db;
        }

        async query() {
          return this.db.query('SELECT * FROM data');
        }
      }

      const db = new Database();
      const controller = new DataController(db);

      expect(controller.db).toBe(db);
      expect(controller.db.query('SELECT 1')).toBe('executing: SELECT 1');
    });

    it('should allow controllers without dependencies (no inject)', () => {
      class NoDepsController extends Controller {
        static readonly metadata = {
          basePath: '/health',
          routes: [
            { method: 'GET', path: '/', handler: 'check' },
          ] as const satisfies ControllerRoute<NoDepsController>[],
        };

        async check() {
          return { status: 'ok' };
        }
      }

      const controller = new NoDepsController();
      expect(controller).toBeInstanceOf(Controller);
      expect(NoDepsController.inject).toBeUndefined();
    });

    it('should support inject with ControllerConstructor type', () => {
      class Logger {
        log(_msg: string) {}
      }

      class LoggedController extends Controller {
        static readonly inject: DepsTokens<typeof this> = [Logger];
        static readonly metadata = {
          basePath: '/logged',
        } as const satisfies ControllerMetadata;

        logger: Logger;
        constructor(logger: Logger) {
          super();
          this.logger = logger;
        }
      }

      const ControllerClass: ControllerConstructor = LoggedController;
      expect(ControllerClass.inject).toBeDefined();
      expect(ControllerClass.metadata?.basePath).toBe('/logged');
    });
  });
});
