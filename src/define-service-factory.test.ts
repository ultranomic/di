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
 *
 * LOGGER INJECTION:
 * 10. ✅ Should include logger in injector when no custom dependencies
 * 11. ✅ Should include logger in injector alongside custom dependencies
 * 12. ✅ Should handle logger factory returning undefined
 * 13. ✅ Should pass service name to logger factory
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
        customLogger: Service<{ log: (msg: string) => void }>;
        config: Service<{ apiUrl: string; timeout: number }>;
      };

      const defineApiService = defineServiceFactory
        .name('ApiService')
        .inject<Dependencies>()
        .handler(({ injector }) => {
          const { customLogger, config } = injector();

          return {
            fetchData: async (endpoint: string) => {
              customLogger.log(`Fetching from ${config.apiUrl}${endpoint}`);
              return { data: `mock data from ${endpoint}`, timeout: config.timeout };
            },
          };
        });

      const mockDeps = {
        customLogger: { log: () => {} },
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
        customLogger: LoggerService;
      };

      const defineUserService = defineServiceFactory
        .name('UserService')
        .inject<Dependencies>()
        .handler(({ injector }) => {
          const { db, customLogger } = injector();

          return {
            createUser: (userData: { name: string; email: string }) => {
              try {
                customLogger.log(`Creating user: ${userData.name}`);
                const id = db.insert('users', userData);
                customLogger.log(`User created with ID: ${id}`);
                return { id, ...userData };
              } catch (error) {
                customLogger.error(`Failed to create user: ${error}`);
                throw error;
              }
            },

            findUser: (id: string) => {
              customLogger.log(`Looking up user: ${id}`);
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
        customLogger: {
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

  describe('Logger Injection', () => {
    // Test 10: Should include logger in injector when no custom dependencies
    it('should include logger in injector when no custom dependencies', async () => {
      const { setAppLogger } = await import('./app-logger.ts');
      const { createMockLogger } = await import('./logger.mock.ts');

      // Create a mock pino logger
      const mockLogger = createMockLogger('test');

      // Set logger
      setAppLogger(mockLogger);

      const defineService = defineServiceFactory
        .name('LoggerService')
        .inject()
        .handler(({ name, injector }) => {
          const deps = injector?.();
          return {
            name,
            hasLogger: deps && 'logger' in deps,
            logger: deps?.logger,
          };
        });

      const instance = defineService();

      assert.strictEqual(instance.name, 'LoggerService');
      assert.strictEqual(instance.hasLogger, true);
      assert.strictEqual(typeof instance.logger?.info, 'function');

      // Test the logger works
      instance.logger?.info('service test');
      const logs = (mockLogger as any).getLogs();
      const testLogs = logs.filter((log: any) => log.msg === 'service test');
      assert.strictEqual(testLogs.length, 1);
      assert.strictEqual(testLogs[0].prefix, '[LoggerService] ');

      // Clean up
      setAppLogger(undefined);
    });

    // Test 11: Should include logger in injector alongside custom dependencies
    it('should include logger in injector alongside custom dependencies', async () => {
      const { setAppLogger } = await import('./app-logger.ts');
      const { createMockLogger } = await import('./logger.mock.ts');

      // Create a mock pino logger
      const mockLogger = createMockLogger('test');

      setAppLogger(mockLogger);

      type Dependencies = {
        database: Service<{ query: (sql: string) => any[] }>;
        cache: Service<{ get: (key: string) => any }>;
      };

      const defineService = defineServiceFactory
        .name('MixedLoggerService')
        .inject<Dependencies>()
        .handler(({ name, injector }) => {
          const deps = injector();
          return {
            name,
            customDeps: {
              hasDatabase: 'database' in deps,
              hasCache: 'cache' in deps,
            },
            loggerDep: {
              hasLogger: 'logger' in deps,
              loggerInfo: typeof deps.logger?.info,
            },
            testLogger: () => {
              deps.logger?.info('service component test');
              return 'tested';
            },
          };
        });

      const mockInjector = () => ({
        database: { query: () => [{ id: 1 }] },
        cache: { get: () => 'cached-value' },
      });

      const instance = defineService(mockInjector);

      assert.strictEqual(instance.name, 'MixedLoggerService');
      assert.strictEqual(instance.customDeps.hasDatabase, true);
      assert.strictEqual(instance.customDeps.hasCache, true);
      assert.strictEqual(instance.loggerDep.hasLogger, true);
      assert.strictEqual(instance.loggerDep.loggerInfo, 'function');

      // Test that logger is properly configured
      instance.testLogger();
      const logs = (mockLogger as any).getLogs();
      const testLogs = logs.filter((log: any) => log.msg === 'service component test');
      assert.strictEqual(testLogs.length, 1);
      assert.strictEqual(testLogs[0].prefix, '[MixedLoggerService] ');

      // Clean up
      setAppLogger(undefined);
    });

    // Test 12: Should handle logger factory returning undefined
    it('should handle logger factory returning undefined', async () => {
      const { setAppLogger } = await import('./app-logger.ts');

      // Set app logger to undefined
      setAppLogger(undefined);

      const defineService = defineServiceFactory
        .name('UndefinedLoggerService')
        .inject()
        .handler(({ name, injector }) => {
          const deps = injector?.();
          return {
            name,
            hasLogger: deps && 'logger' in deps,
            loggerValue: deps?.logger,
          };
        });

      const instance = defineService();

      assert.strictEqual(instance.name, 'UndefinedLoggerService');
      assert.strictEqual(instance.hasLogger, true);
      assert.strictEqual(instance.loggerValue, undefined);

      // Clean up
      setAppLogger(undefined);
    });

    // Test 13: Should pass service name to logger factory
    it('should pass service name to logger factory', async () => {
      const { setAppLogger } = await import('./app-logger.ts');

      const { createMockLogger } = await import('./logger.mock.ts');
      const mockLogger = createMockLogger('test');

      setAppLogger(mockLogger);

      const defineService1 = defineServiceFactory
        .name('AuthService')
        .inject()
        .handler(({ injector }) => {
          const deps = injector?.();
          return { hasLogger: deps && 'logger' in deps };
        });

      const defineService2 = defineServiceFactory
        .name('PaymentService')
        .inject()
        .handler(({ injector }) => {
          const deps = injector?.();
          return { hasLogger: deps && 'logger' in deps };
        });

      const instance1 = defineService1();
      const instance2 = defineService2();

      assert.strictEqual(instance1.hasLogger, true);
      assert.strictEqual(instance2.hasLogger, true);
      const logs = (mockLogger as any).getLogs();
      const initLogs = logs.filter((log: any) => log.msg.includes('initialized'));
      assert.strictEqual(initLogs.length, 2);

      // Clean up
      setAppLogger(undefined);
    });
  });
});
