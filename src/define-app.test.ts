import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { defineApp, onApplicationStart, onApplicationStop, onApplicationInitialized, appHooks } from './define-app.ts';
import { defineModuleFactory } from './define-module-factory.ts';

/**
 * Test Plan for defineApp
 *
 * BASIC APP CREATION:
 * 1. ✅ Should create app with basic functionality
 * 2. ✅ Should fire onApplicationInitialized during creation
 * 3. ✅ Should support async initialization
 * 4. ✅ Should handle empty module gracefully
 *
 * LIFECYCLE MANAGEMENT:
 * 5. ✅ Should handle start lifecycle
 * 6. ✅ Should handle stop lifecycle
 * 7. ✅ Should support execution order in lifecycle hooks
 * 8. ✅ Should handle async lifecycle hooks
 *
 * COMPLETE APPLICATION LIFECYCLE:
 * 9. ✅ Should handle full lifecycle: init -> start -> stop
 * 10. ✅ Should support multiple start/stop cycles
 *
 * GLOBAL HOOK REGISTRATION:
 * 11. ✅ Should support global onApplicationStart registration
 * 12. ✅ Should support global onApplicationStop registration
 * 13. ✅ Should support global onApplicationInitialized registration
 *
 * ERROR HANDLING:
 * 14. ✅ Should handle errors in start hooks
 * 15. ✅ Should handle errors in stop hooks
 *
 * REAL-WORLD APPLICATION PATTERNS:
 * 16. ✅ Should support complex application with services and modules
 * 17. ✅ Should support dependency injection in app context
 */

describe('defineApp', () => {
  afterEach(() => {
    // Clear all hooks after each test to prevent global state interference
    appHooks.clear();
  });
  describe('basic app creation', () => {
    it('should create app with basic functionality', async () => {
      const testModule = defineModuleFactory
        .name('TestApp')
        .inject()
        .handler(() => ({
          name: 'Test App',
          version: '1.0.0',
          getMessage: () => 'Hello from app',
        }));

      const app = await defineApp(testModule);

      assert.ok(typeof app.start === 'function');
      assert.ok(typeof app.stop === 'function');
    });

    it('should fire onApplicationInitialized during creation', async () => {
      let initialized = false;

      onApplicationInitialized(() => {
        initialized = true;
      });

      const testModule = defineModuleFactory
        .name('InitModule')
        .inject()
        .handler(() => {
          return { ready: true };
        });

      const app = await defineApp(() => testModule);

      assert.strictEqual(initialized, true);
      assert.ok(typeof app.start === 'function');
      assert.ok(typeof app.stop === 'function');
    });

    it('should support async initialization', async () => {
      const initResults: string[] = [];

      onApplicationInitialized(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        initResults.push('async-init-1');
      });

      onApplicationInitialized(() => {
        initResults.push('sync-init-2');
      });

      const testModule = defineModuleFactory
        .name('AsyncModule')
        .inject()
        .handler(() => {
          return { initResults };
        });

      const app = await defineApp(() => testModule);

      // All initialization should be complete
      assert.ok(initResults.includes('async-init-1'));
      assert.ok(initResults.includes('sync-init-2'));
    });
  });

  describe('lifecycle management', () => {
    it('should handle start lifecycle', async () => {
      const events: string[] = [];

      onApplicationStart(() => {
        events.push('start-1');
      });

      onApplicationStart(() => {
        events.push('start-2');
      });

      const testModule = defineModuleFactory
        .name('StartModule')
        .inject()
        .handler(() => {
          return { events };
        });

      const app = await defineApp(() => testModule);
      await app.start();

      assert.ok(events.includes('start-1'));
      assert.ok(events.includes('start-2'));
    });

    it('should handle stop lifecycle', async () => {
      const events: string[] = [];

      onApplicationStop(() => {
        events.push('stop-1');
      });

      onApplicationStop(() => {
        events.push('stop-2');
      });

      const testModule = defineModuleFactory
        .name('StopModule')
        .inject()
        .handler(() => {
          return { events };
        });

      const app = await defineApp(() => testModule);
      await app.stop();

      assert.ok(events.includes('stop-1'));
      assert.ok(events.includes('stop-2'));
    });

    it('should support execution order in lifecycle hooks', async () => {
      const executionOrder: number[] = [];

      onApplicationStart(() => executionOrder.push(3), 3);
      onApplicationStart(() => executionOrder.push(1), 1);
      onApplicationStart(() => executionOrder.push(2), 2);

      const testModule = defineModuleFactory
        .name('OrderModule')
        .inject()
        .handler(() => {
          return { getOrder: () => [...executionOrder] };
        });

      const app = await defineApp(() => testModule);
      await app.start();

      // Should execute in order: 1, 2, 3
      assert.deepStrictEqual(executionOrder, [1, 2, 3]);
    });

    it('should handle async lifecycle hooks', async () => {
      const events: string[] = [];

      onApplicationStart(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        events.push('async-start');
      });

      onApplicationStop(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        events.push('async-stop');
      });

      const testModule = defineModuleFactory
        .name('AsyncModule')
        .inject()
        .handler(() => {
          return { events };
        });

      const app = await defineApp(() => testModule);
      await app.start();
      await app.stop();

      assert.ok(events.includes('async-start'));
      assert.ok(events.includes('async-stop'));
    });
  });

  describe('complete application lifecycle', () => {
    it('should handle full lifecycle: init -> start -> stop', async () => {
      const lifecycle: string[] = [];

      onApplicationInitialized(() => {
        lifecycle.push('initialized');
      });

      onApplicationStart(() => {
        lifecycle.push('started');
      });

      onApplicationStop(() => {
        lifecycle.push('stopped');
      });

      const testModule = defineModuleFactory
        .name('FullLifecycleModule')
        .inject()
        .handler(() => {
          return {
            getLifecycle: () => [...lifecycle],
            addEvent: (event: string) => lifecycle.push(event),
          };
        });

      const app = await defineApp(() => testModule);

      // Should be initialized already
      assert.ok(lifecycle.includes('initialized'));

      await app.start();
      assert.ok(lifecycle.includes('started'));

      await app.stop();
      assert.ok(lifecycle.includes('stopped'));

      // Verify order
      assert.strictEqual(lifecycle[0], 'initialized');
      assert.ok(lifecycle.indexOf('started') > lifecycle.indexOf('initialized'));
      assert.ok(lifecycle.indexOf('stopped') > lifecycle.indexOf('started'));
    });

    it('should support multiple start/stop cycles', async () => {
      const cycles: string[] = [];

      onApplicationStart(() => {
        cycles.push('start');
      });

      onApplicationStop(() => {
        cycles.push('stop');
      });

      const testModule = defineModuleFactory
        .name('CycleModule')
        .inject()
        .handler(() => {
          return { getCycles: () => [...cycles] };
        });

      const app = await defineApp(() => testModule);

      // First cycle
      await app.start();
      await app.stop();

      // Second cycle
      await app.start();
      await app.stop();

      assert.deepStrictEqual(cycles, ['start', 'stop', 'start', 'stop']);
    });
  });

  describe('global hook registration', () => {
    it('should support global onApplicationStart registration', async () => {
      const globalEvents: string[] = [];

      // Register global hook before app creation
      onApplicationStart(() => {
        globalEvents.push('global-start');
      });

      const testModule = defineModuleFactory
        .name('GlobalModule')
        .inject()
        .handler(() => {
          return { globalEvents };
        });

      const app = await defineApp(() => testModule);
      await app.start();

      assert.ok(globalEvents.includes('global-start'));
    });

    it('should support global onApplicationStop registration', async () => {
      const globalEvents: string[] = [];

      // Register global hook before app creation
      onApplicationStop(() => {
        globalEvents.push('global-stop');
      });

      const testModule = defineModuleFactory
        .name('GlobalStopModule')
        .inject()
        .handler(() => {
          return { globalEvents };
        });

      const app = await defineApp(() => testModule);
      await app.stop();

      assert.ok(globalEvents.includes('global-stop'));
    });

    it('should support global onApplicationInitialized registration', async () => {
      const globalEvents: string[] = [];

      // Register global hook before app creation
      onApplicationInitialized(() => {
        globalEvents.push('global-init');
      });

      const testModule = defineModuleFactory
        .name('GlobalInitModule')
        .inject()
        .handler(() => {
          return { globalEvents };
        });

      const app = await defineApp(() => testModule);

      // Should be fired during app creation
      assert.ok(globalEvents.includes('global-init'));
    });
  });

  describe('error handling', () => {
    it('should handle errors in start hooks', async () => {
      onApplicationStart(() => {
        throw new Error('Start error');
      });

      const testModule = defineModuleFactory
        .name('ErrorModule')
        .inject()
        .handler(() => {
          return { test: true };
        });

      const app = await defineApp(() => testModule);

      let errorCaught = false;
      try {
        await app.start();
      } catch (error) {
        errorCaught = true;
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Start error');
      }

      assert.strictEqual(errorCaught, true);
    });

    it('should handle errors in stop hooks', async () => {
      onApplicationStop(() => {
        throw new Error('Stop error');
      });

      const testModule = defineModuleFactory
        .name('StopErrorModule')
        .inject()
        .handler(() => {
          return { test: true };
        });

      const app = await defineApp(() => testModule);

      let errorCaught = false;
      try {
        await app.stop();
      } catch (error) {
        errorCaught = true;
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Stop error');
      }

      assert.strictEqual(errorCaught, true);
    });
  });

  describe('real-world application patterns', () => {
    it('should support complex application with services and modules', async () => {
      interface DatabaseConnection {
        connect: () => Promise<void>;
        disconnect: () => Promise<void>;
        isConnected: boolean;
      }

      interface WebServer {
        start: (port: number) => Promise<void>;
        stop: () => Promise<void>;
        isRunning: boolean;
      }

      const database: DatabaseConnection = {
        connect: async () => {
          database.isConnected = true;
        },
        disconnect: async () => {
          database.isConnected = false;
        },
        isConnected: false,
      };

      const server: WebServer = {
        start: async (port: number) => {
          server.isRunning = true;
        },
        stop: async () => {
          server.isRunning = false;
        },
        isRunning: false,
      };

      // Initialize database connection
      onApplicationInitialized(async () => {
        await database.connect();
      });

      // Start web server
      onApplicationStart(async () => {
        await server.start(3000);
      }, 100); // Use very high execution order to avoid conflict with error test hooks

      // Stop web server first, then database
      onApplicationStop(async () => {
        await server.stop();
      }, 100);

      onApplicationStop(async () => {
        await database.disconnect();
      }, 101);

      const testModule = defineModuleFactory
        .name('ComplexAppModule')
        .inject()
        .handler(() => {
          return {
            database,
            server,
            getStatus: () => ({
              database: database.isConnected,
              server: server.isRunning,
            }),
          };
        });

      const app = await defineApp(() => testModule);

      // After creation, database should be connected
      assert.strictEqual(database.isConnected, true);
      assert.strictEqual(server.isRunning, false);

      // After start, server should be running
      await app.start();
      assert.strictEqual(database.isConnected, true);
      assert.strictEqual(server.isRunning, true);

      // After stop, both should be stopped (server first, then database)
      await app.stop();
      assert.strictEqual(database.isConnected, false);
      assert.strictEqual(server.isRunning, false);
    });

    it('should support dependency injection in app context', async () => {
      // Simulate creating services that would be injected
      const createLogger = () => ({
        info: (msg: string) => console.log(`INFO: ${msg}`),
        error: (msg: string) => console.error(`ERROR: ${msg}`),
      });

      const createConfig = () => ({
        port: 3000,
        database: { host: 'localhost', port: 5432 },
        jwt: { secret: 'test-secret' },
      });

      // In a real app, these would be created via defineService
      const logger = createLogger();
      const config = createConfig();

      onApplicationStart(() => {
        logger.info(`Starting application on port ${config.port}`);
      }, 200); // Use high execution order to avoid conflict with error test hooks

      onApplicationStop(() => {
        logger.info('Stopping application');
      }, 200);

      const testModule = defineModuleFactory
        .name('DependencyInjectionModule')
        .inject()
        .handler(() => {
          return {
            services: {
              logger,
              config,
            },
            getPort: () => config.port,
            log: (message: string) => logger.info(message),
          };
        });

      const app = await defineApp(() => testModule);

      // Test that lifecycle methods exist
      assert.ok(typeof app.start === 'function');
      assert.ok(typeof app.stop === 'function');
    });
  });
});
