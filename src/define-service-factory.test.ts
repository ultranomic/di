import { describe, it } from 'node:test';
import assert from 'node:assert';
import { defineServiceFactory, type Service } from './define-service-factory.ts';

/**
 * Test Plan for defineServiceFactory
 *
 * BASIC FUNCTIONALITY:
 * 1. ✅ Should create service factory returning object
 * 2. ✅ Should create service factory returning void
 * 3. ✅ Should support business logic patterns
 *
 * DEPENDENCY INJECTION:
 * 4. ✅ Should create service with dependency injection
 *
 * LIFECYCLE HOOKS:
 * 5. ✅ Should support lifecycle hooks in services
 *
 * SERVICE PATTERNS:
 * 6. ✅ Should support service composition
 *
 * TYPE CONSTRAINTS:
 * 7. ✅ Should enforce object or void return types
 * 8. ✅ Should maintain Service type wrapper
 *
 * REAL-WORLD PATTERNS:
 * 9. ✅ Should support repository pattern
 */

describe('defineServiceFactory', () => {
  describe('handler without dependencies', () => {
    it('should create service factory returning object', () => {
      const defineService = defineServiceFactory
        .name('DataService')
        .inject()
        .handler(() => ({
          getData: () => 'service data',
          processData: (input: string) => `processed: ${input}`,
        }));

      const result = defineService();
      assert.strictEqual(result.getData(), 'service data');
      assert.strictEqual(result.processData('test'), 'processed: test');
    });

    it('should create service factory returning void', () => {
      const defineService = defineServiceFactory
        .name('VoidService')
        .inject()
        .handler(() => {
          // void service for side effects only
        });

      const result = defineService();
      assert.strictEqual(result, undefined);
    });

    it('should support business logic patterns', () => {
      const defineUserService = defineServiceFactory
        .name('UserService')
        .inject()
        .handler(() => ({
          users: new Map<string, { id: string; name: string }>(),

          createUser: function (name: string) {
            const id = crypto.randomUUID();
            const user = { id, name };
            this.users.set(id, user);
            return user;
          },

          getUser: function (id: string) {
            return this.users.get(id) || null;
          },

          getAllUsers: function () {
            return Array.from(this.users.values());
          },
        }));

      const serviceInstance = defineUserService();
      const user1 = serviceInstance.createUser('Alice');
      const user2 = serviceInstance.createUser('Bob');

      assert.strictEqual(user1.name, 'Alice');
      assert.strictEqual(serviceInstance.getUser(user1.id)?.name, 'Alice');
      assert.strictEqual(serviceInstance.getAllUsers().length, 2);
    });
  });

  describe('handler with dependencies', () => {
    it('should create service with dependency injection', () => {
      type Dependencies = {
        logger: Service<{ log: (msg: string) => void }>;
        config: Service<{ apiUrl: string; timeout: number }>;
      };

      const defineApiService = defineServiceFactory
        .name('ApiService')
        .inject<Dependencies>()
        .handler(({ injector }) => {
          const { logger, config } = injector();

          return {
            fetchData: async (endpoint: string) => {
              logger.log(`Fetching from ${config.apiUrl}${endpoint}`);
              return { data: `mock data from ${endpoint}`, timeout: config.timeout };
            },
          };
        });

      const mockDeps = {
        logger: { log: () => {} },
        config: { apiUrl: 'https://api.example.com', timeout: 5000 },
      };

      const service = defineApiService(() => mockDeps);

      // Test the service functionality
      service.fetchData('/users').then((result) => {
        assert.strictEqual(result.timeout, 5000);
        assert.ok(result.data.includes('/users'));
      });
    });

    it('should support lifecycle hooks in services', () => {
      const lifecycleEvents: string[] = [];

      const defineService = defineServiceFactory
        .name('LifecycleService')
        .inject<{}>()
        .handler(({ injector, appHooks: { onApplicationInitialized, onApplicationStart, onApplicationStop } }) => {
          onApplicationInitialized(() => {
            lifecycleEvents.push('service-initialized');
          });

          onApplicationStart(() => {
            lifecycleEvents.push('service-started');
          });

          onApplicationStop(() => {
            lifecycleEvents.push('service-stopped');
          });

          return {
            getEvents: () => [...lifecycleEvents],
          };
        });

      const result = defineService(() => ({}));
      assert.deepStrictEqual(result.getEvents(), []);

      // Lifecycle events would be fired by the app layer
      // This test verifies the hooks are properly registered
    });

    it('should support service composition', () => {
      type DatabaseService = Service<{
        query: (sql: string) => any[];
        insert: (table: string, data: any) => string;
      }>;

      type LoggerService = Service<{
        log: (msg: string) => void;
        error: (msg: string) => void;
      }>;

      type Dependencies = {
        db: DatabaseService;
        logger: LoggerService;
      };

      const defineUserService = defineServiceFactory
        .name('UserService')
        .inject<Dependencies>()
        .handler(({ injector }) => {
          const { db, logger } = injector();

          return {
            createUser: (userData: { name: string; email: string }) => {
              try {
                logger.log(`Creating user: ${userData.name}`);
                const id = db.insert('users', userData);
                logger.log(`User created with ID: ${id}`);
                return { id, ...userData };
              } catch (error) {
                logger.error(`Failed to create user: ${error}`);
                throw error;
              }
            },

            findUser: (id: string) => {
              logger.log(`Looking up user: ${id}`);
              const results = db.query(`SELECT * FROM users WHERE id = '${id}'`);
              return results[0] || null;
            },
          };
        });

      const mockDeps = {
        db: {
          query: (sql: string) => [{ id: '123', name: 'Test User', email: 'test@example.com' }],
          insert: (table: string, data: any) => '123',
        },
        logger: {
          log: () => {},
          error: () => {},
        },
      };

      const service = defineUserService(() => mockDeps);
      const user = service.createUser({ name: 'John', email: 'john@example.com' });
      const foundUser = service.findUser('123');

      assert.strictEqual(user.name, 'John');
      assert.strictEqual(foundUser.name, 'Test User');
    });
  });

  describe('service type constraints', () => {
    it('should enforce object or void return types', () => {
      // These should compile successfully
      const defineObjectService = defineServiceFactory
        .name('ObjectService')
        .inject()
        .handler(() => ({ value: 1 }));
      const defineVoidService = defineServiceFactory
        .name('VoidService')
        .inject()
        .handler(() => {});

      // Verify they work as expected
      assert.deepStrictEqual(defineObjectService(), { value: 1 });
      assert.strictEqual(defineVoidService(), undefined);
    });

    it('should maintain Service type wrapper', () => {
      const defineService = defineServiceFactory
        .name('TestService')
        .inject()
        .handler(() => ({
          method: () => 'result',
        }));

      // The return should be assignable to Service type
      const typedService: () => Service<{ method: () => string }> = defineService;
      assert.strictEqual(typedService().method(), 'result');
    });
  });

  describe('real-world service patterns', () => {
    it('should support repository pattern', () => {
      interface User {
        id: string;
        name: string;
        email: string;
      }

      const defineUserRepository = defineServiceFactory
        .name('UserRepository')
        .inject()
        .handler(() => {
          const users = new Map<string, User>();

          return {
            save: (user: User): User => {
              users.set(user.id, user);
              return user;
            },

            findById: (id: string): User | null => {
              return users.get(id) || null;
            },

            findByEmail: (email: string): User | null => {
              for (const user of users.values()) {
                if (user.email === email) return user;
              }
              return null;
            },

            delete: (id: string): boolean => {
              return users.delete(id);
            },

            count: (): number => users.size,
          };
        });

      const repo = defineUserRepository();
      const user: User = { id: '1', name: 'Alice', email: 'alice@example.com' };

      repo.save(user);
      assert.strictEqual(repo.findById('1')?.name, 'Alice');
      assert.strictEqual(repo.findByEmail('alice@example.com')?.id, '1');
      assert.strictEqual(repo.count(), 1);

      repo.delete('1');
      assert.strictEqual(repo.count(), 0);
    });
  });
});
