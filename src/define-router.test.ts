import { describe, it } from 'node:test';
import assert from 'node:assert';
import { defineRouter, type Router } from './define-router.ts';
import { type Service } from './define-service.ts';
import { type Module } from './define-module.ts';

describe('defineRouter', () => {
  describe('handler without dependencies', () => {
    it('should create router returning object', () => {
      const router = defineRouter.handler(() => ({
        '/api/health': {
          GET: () => ({ status: 'ok' }),
        },
        '/api/ping': {
          GET: () => ({ message: 'pong' }),
        },
      }));

      const result = router();
      const healthResponse = result['/api/health'].GET();
      const pingResponse = result['/api/ping'].GET();

      assert.deepStrictEqual(healthResponse, { status: 'ok' });
      assert.deepStrictEqual(pingResponse, { message: 'pong' });
    });

    it('should create router returning void', () => {
      const router = defineRouter.handler(() => {
        // void router for side effects only
      });

      const result = router();
      assert.strictEqual(result, undefined);
    });

    it('should support multiple HTTP methods', () => {
      const router = defineRouter.handler(() => ({
        '/api/users': {
          GET: () => ({ users: [] }),
          POST: (data: { name: string }) => ({ id: '123', ...data }),
          PUT: (id: string, data: { name: string }) => ({ id, ...data }),
          DELETE: (id: string) => ({ deleted: id }),
        },
      }));

      const result = router();
      const endpoints = result['/api/users'];

      assert.deepStrictEqual(endpoints.GET(), { users: [] });
      assert.deepStrictEqual(endpoints.POST({ name: 'John' }), { id: '123', name: 'John' });
      assert.deepStrictEqual(endpoints.PUT('456', { name: 'Jane' }), { id: '456', name: 'Jane' });
      assert.deepStrictEqual(endpoints.DELETE('789'), { deleted: '789' });
    });
  });

  describe('handler with dependencies', () => {
    it('should create router with service dependencies', () => {
      type Dependencies = {
        userService: Service<{
          getUser: (id: string) => { id: string; name: string };
          createUser: (data: { name: string }) => { id: string; name: string };
        }>;
        authService: Service<{
          validateToken: (token: string) => boolean;
          getCurrentUser: (token: string) => { id: string; name: string } | null;
        }>;
      };

      const userRouter = defineRouter.inject<Dependencies>().handler((injector) => {
        const { userService, authService } = injector();

        return {
          '/api/users/:id': {
            GET: ({ params, headers }: { params: { id: string }; headers: { authorization?: string } }) => {
              const token = headers.authorization?.replace('Bearer ', '');
              if (!token || !authService.validateToken(token)) {
                return { error: 'Unauthorized', status: 401 };
              }

              const user = userService.getUser(params.id);
              return { user };
            },
          },

          '/api/users': {
            POST: ({ body, headers }: { body: { name: string }; headers: { authorization?: string } }) => {
              const token = headers.authorization?.replace('Bearer ', '');
              if (!token || !authService.validateToken(token)) {
                return { error: 'Unauthorized', status: 401 };
              }

              const user = userService.createUser(body);
              return { user, status: 201 };
            },
          },
        };
      });

      const mockDeps = {
        userService: {
          getUser: (id: string) => ({ id, name: `User ${id}` }),
          createUser: (data: { name: string }) => ({
            id: `user-${Date.now()}`,
            ...data,
          }),
        },
        authService: {
          validateToken: (token: string) => token === 'valid-token',
          getCurrentUser: (token: string) =>
            token === 'valid-token' ? { id: 'current-user', name: 'Current User' } : null,
        },
      };

      const router = userRouter(() => mockDeps);

      // Test authenticated request
      const getUserResponse = router['/api/users/:id'].GET({
        params: { id: '123' },
        headers: { authorization: 'Bearer valid-token' },
      });

      assert.strictEqual(getUserResponse.user.name, 'User 123');

      // Test unauthenticated request
      const unauthorizedResponse = router['/api/users/:id'].GET({
        params: { id: '123' },
        headers: {},
      });

      assert.strictEqual(unauthorizedResponse.error, 'Unauthorized');
      assert.strictEqual(unauthorizedResponse.status, 401);
    });

    it('should support module dependencies', () => {
      type UserModule = Module<{
        getUserWithPosts: (id: string) => {
          user: { id: string; name: string };
          posts: Array<{ id: string; title: string }>;
        };
      }>;

      type Dependencies = {
        userModule: UserModule;
      };

      const apiRouter = defineRouter.inject<Dependencies>().handler((injector) => {
        const { userModule } = injector();

        return {
          '/api/users/:id/complete': {
            GET: ({ params }: { params: { id: string } }) => {
              const userData = userModule.getUserWithPosts(params.id);
              return {
                ...userData,
                timestamp: new Date().toISOString(),
              };
            },
          },
        };
      });

      const mockDeps = {
        userModule: {
          getUserWithPosts: (id: string) => ({
            user: { id, name: `User ${id}` },
            posts: [
              { id: 'post-1', title: 'First Post' },
              { id: 'post-2', title: 'Second Post' },
            ],
          }),
        },
      };

      const router = apiRouter(() => mockDeps);
      const response = router['/api/users/:id/complete'].GET({ params: { id: '123' } });

      assert.strictEqual(response.user.name, 'User 123');
      assert.strictEqual(response.posts.length, 2);
      assert.ok(response.timestamp);
    });

    it('should support lifecycle hooks', () => {
      const routerEvents: string[] = [];

      const router = defineRouter.inject<{}>().handler((injector, { onApplicationStart, onApplicationStop }) => {
        onApplicationStart(() => {
          routerEvents.push('router-started');
        }, 2);

        onApplicationStop(() => {
          routerEvents.push('router-stopped');
        }, 2);

        return {
          '/api/events': {
            GET: () => ({ events: [...routerEvents] }),
          },
        };
      });

      const result = router(() => ({}));
      const response = result['/api/events'].GET();

      assert.deepStrictEqual(response.events, []);
      // Lifecycle events would be fired by the app layer
    });

    it('should support middleware patterns', () => {
      type MiddlewareService = Service<{
        cors: (req: any, res: any, next: () => void) => void;
        rateLimit: (req: any, res: any, next: () => void) => void;
        logger: (req: any, res: any, next: () => void) => void;
      }>;

      type Dependencies = {
        middleware: MiddlewareService;
      };

      const router = defineRouter.inject<Dependencies>().handler((injector) => {
        const { middleware } = injector();

        const withMiddleware = (handler: Function) => {
          return (req: any) => {
            // Simulate middleware chain
            const middlewares = [middleware.cors, middleware.rateLimit, middleware.logger];

            // In real implementation, this would properly chain middlewares
            return handler(req);
          };
        };

        return {
          '/api/protected': {
            GET: withMiddleware(({ user }: { user: { id: string } }) => ({
              message: `Hello ${user.id}`,
              protected: true,
            })),
          },
        };
      });

      const mockDeps = {
        middleware: {
          cors: () => {},
          rateLimit: () => {},
          logger: () => {},
        },
      };

      const result = router(() => mockDeps);
      const response = result['/api/protected'].GET({ user: { id: 'test-user' } });

      assert.strictEqual(response.message, 'Hello test-user');
      assert.strictEqual(response.protected, true);
    });
  });

  describe('router type constraints', () => {
    it('should enforce Record or void return types', () => {
      // These should compile successfully
      const recordRouter = defineRouter.handler(() => ({
        '/route': { GET: () => 'response' },
      }));
      const voidRouter = defineRouter.handler(() => {});

      // Verify they work as expected
      assert.strictEqual(recordRouter()['/route'].GET(), 'response');
      assert.strictEqual(voidRouter(), undefined);
    });

    it('should maintain Router type wrapper', () => {
      const router = defineRouter.handler(() => ({
        '/test': { GET: () => 'test' },
      }));

      // The return should be assignable to Router type
      const typedRouter: () => Router<{ '/test': { GET: () => string } }> = router;
      assert.strictEqual(typedRouter()['/test'].GET(), 'test');
    });
  });

  describe('real-world router patterns', () => {
    it('should support REST API pattern', () => {
      interface User {
        id: string;
        name: string;
        email: string;
      }

      const restRouter = defineRouter.handler(() => {
        const users = new Map<string, User>();

        return {
          '/api/users': {
            GET: () => ({ users: Array.from(users.values()) }),
            POST: ({ body }: { body: Omit<User, 'id'> }) => {
              const user: User = { id: crypto.randomUUID(), ...body };
              users.set(user.id, user);
              return { user, status: 201 };
            },
          },

          '/api/users/:id': {
            GET: ({ params }: { params: { id: string } }) => {
              const user = users.get(params.id);
              return user ? { user } : { error: 'User not found', status: 404 };
            },

            PUT: ({ params, body }: { params: { id: string }; body: Partial<Omit<User, 'id'>> }) => {
              const user = users.get(params.id);
              if (!user) {
                return { error: 'User not found', status: 404 };
              }

              const updatedUser = { ...user, ...body };
              users.set(params.id, updatedUser);
              return { user: updatedUser };
            },

            DELETE: ({ params }: { params: { id: string } }) => {
              const deleted = users.delete(params.id);
              return deleted ? { message: 'User deleted' } : { error: 'User not found', status: 404 };
            },
          },
        };
      });

      const router = restRouter();

      // Create user
      const createResponse = router['/api/users'].POST({
        body: { name: 'John Doe', email: 'john@example.com' },
      });

      assert.strictEqual(createResponse.status, 201);
      assert.strictEqual(createResponse.user.name, 'John Doe');

      const userId = createResponse.user.id;

      // Get user
      const getResponse = router['/api/users/:id'].GET({ params: { id: userId } });
      assert.strictEqual(getResponse.user.name, 'John Doe');

      // Update user
      const updateResponse = router['/api/users/:id'].PUT({
        params: { id: userId },
        body: { name: 'Jane Doe' },
      });
      assert.strictEqual(updateResponse.user.name, 'Jane Doe');

      // Delete user
      const deleteResponse = router['/api/users/:id'].DELETE({ params: { id: userId } });
      assert.strictEqual(deleteResponse.message, 'User deleted');

      // Verify deletion
      const notFoundResponse = router['/api/users/:id'].GET({ params: { id: userId } });
      assert.strictEqual(notFoundResponse.status, 404);
    });
  });
});
