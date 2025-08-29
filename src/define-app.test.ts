import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { defineApp, onApplicationStart, onApplicationStop, onApplicationInitialized, appHooks } from './define-app.ts';

describe('defineApp', () => {
  afterEach(() => {
    // Clear all hooks after each test to prevent global state interference
    appHooks.clear();
  });
  describe('basic app creation', () => {
    it('should create app with basic functionality', async () => {
      const app = await defineApp(() => ({
        name: 'Test App',
        version: '1.0.0',
        getMessage: () => 'Hello from app'
      }));

      assert.strictEqual(app.name, 'Test App');
      assert.strictEqual(app.version, '1.0.0');
      assert.strictEqual(app.getMessage(), 'Hello from app');
      assert.ok(typeof app.start === 'function');
      assert.ok(typeof app.stop === 'function');
    });

    it('should fire onApplicationInitialized during creation', async () => {
      let initialized = false;
      
      const app = await defineApp(({ onApplicationInitialized }) => {
        onApplicationInitialized(() => {
          initialized = true;
        });
        
        return { ready: true };
      });

      assert.strictEqual(initialized, true);
      assert.strictEqual(app.ready, true);
    });

    it('should support async initialization', async () => {
      const initResults: string[] = [];
      
      const app = await defineApp(({ onApplicationInitialized }) => {
        onApplicationInitialized(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          initResults.push('async-init-1');
        });
        
        onApplicationInitialized(() => {
          initResults.push('sync-init-2');
        });
        
        return { initResults };
      });

      // All initialization should be complete
      assert.ok(initResults.includes('async-init-1'));
      assert.ok(initResults.includes('sync-init-2'));
    });
  });

  describe('lifecycle management', () => {
    it('should handle start lifecycle', async () => {
      const events: string[] = [];
      
      const app = await defineApp(({ onApplicationStart }) => {
        onApplicationStart(() => {
          events.push('start-1');
        });
        
        onApplicationStart(() => {
          events.push('start-2');
        });
        
        return { events };
      });

      await app.start();
      
      assert.ok(events.includes('start-1'));
      assert.ok(events.includes('start-2'));
    });

    it('should handle stop lifecycle', async () => {
      const events: string[] = [];
      
      const app = await defineApp(({ onApplicationStop }) => {
        onApplicationStop(() => {
          events.push('stop-1');
        });
        
        onApplicationStop(() => {
          events.push('stop-2');
        });
        
        return { events };
      });

      await app.stop();
      
      assert.ok(events.includes('stop-1'));
      assert.ok(events.includes('stop-2'));
    });

    it('should support execution order in lifecycle hooks', async () => {
      const executionOrder: number[] = [];
      
      const app = await defineApp(({ onApplicationStart, onApplicationStop }) => {
        onApplicationStart(() => executionOrder.push(3), 3);
        onApplicationStart(() => executionOrder.push(1), 1);
        onApplicationStart(() => executionOrder.push(2), 2);
        
        return { getOrder: () => [...executionOrder] };
      });

      await app.start();
      
      // Should execute in order: 1, 2, 3
      assert.deepStrictEqual(app.getOrder(), [1, 2, 3]);
    });

    it('should handle async lifecycle hooks', async () => {
      const events: string[] = [];
      
      const app = await defineApp(({ onApplicationStart, onApplicationStop }) => {
        onApplicationStart(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          events.push('async-start');
        });
        
        onApplicationStop(async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          events.push('async-stop');
        });
        
        return { events };
      });

      await app.start();
      await app.stop();
      
      assert.ok(events.includes('async-start'));
      assert.ok(events.includes('async-stop'));
    });
  });

  describe('complete application lifecycle', () => {
    it('should handle full lifecycle: init -> start -> stop', async () => {
      const lifecycle: string[] = [];
      
      const app = await defineApp(({ onApplicationInitialized, onApplicationStart, onApplicationStop }) => {
        onApplicationInitialized(() => {
          lifecycle.push('initialized');
        });
        
        onApplicationStart(() => {
          lifecycle.push('started');
        });
        
        onApplicationStop(() => {
          lifecycle.push('stopped');
        });
        
        return { 
          getLifecycle: () => [...lifecycle],
          addEvent: (event: string) => lifecycle.push(event)
        };
      });

      // Should be initialized already
      assert.ok(app.getLifecycle().includes('initialized'));
      
      await app.start();
      assert.ok(app.getLifecycle().includes('started'));
      
      await app.stop();
      assert.ok(app.getLifecycle().includes('stopped'));
      
      // Verify order
      const finalLifecycle = app.getLifecycle();
      assert.strictEqual(finalLifecycle[0], 'initialized');
      assert.ok(finalLifecycle.indexOf('started') > finalLifecycle.indexOf('initialized'));
      assert.ok(finalLifecycle.indexOf('stopped') > finalLifecycle.indexOf('started'));
    });

    it('should support multiple start/stop cycles', async () => {
      const cycles: string[] = [];
      
      const app = await defineApp(({ onApplicationStart, onApplicationStop }) => {
        onApplicationStart(() => {
          cycles.push('start');
        });
        
        onApplicationStop(() => {
          cycles.push('stop');
        });
        
        return { getCycles: () => [...cycles] };
      });

      // First cycle
      await app.start();
      await app.stop();
      
      // Second cycle
      await app.start();
      await app.stop();
      
      const finalCycles = app.getCycles();
      assert.deepStrictEqual(finalCycles, ['start', 'stop', 'start', 'stop']);
    });
  });

  describe('global hook registration', () => {
    it('should support global onApplicationStart registration', async () => {
      const globalEvents: string[] = [];
      
      // Register global hook before app creation
      onApplicationStart(() => {
        globalEvents.push('global-start');
      });
      
      const app = await defineApp(({ onApplicationStart }) => {
        onApplicationStart(() => {
          globalEvents.push('local-start');
        });
        
        return { globalEvents };
      });

      await app.start();
      
      assert.ok(globalEvents.includes('global-start'));
      assert.ok(globalEvents.includes('local-start'));
    });

    it('should support global onApplicationStop registration', async () => {
      const globalEvents: string[] = [];
      
      // Register global hook before app creation
      onApplicationStop(() => {
        globalEvents.push('global-stop');
      });
      
      const app = await defineApp(({ onApplicationStop }) => {
        onApplicationStop(() => {
          globalEvents.push('local-stop');
        });
        
        return { globalEvents };
      });

      await app.stop();
      
      assert.ok(globalEvents.includes('global-stop'));
      assert.ok(globalEvents.includes('local-stop'));
    });

    it('should support global onApplicationInitialized registration', async () => {
      const globalEvents: string[] = [];
      
      // Register global hook before app creation
      onApplicationInitialized(() => {
        globalEvents.push('global-init');
      });
      
      const app = await defineApp(({ onApplicationInitialized }) => {
        onApplicationInitialized(() => {
          globalEvents.push('local-init');
        });
        
        return { globalEvents };
      });

      // Should be fired during app creation
      assert.ok(globalEvents.includes('global-init'));
      assert.ok(globalEvents.includes('local-init'));
    });
  });

  describe('error handling', () => {
    it('should handle errors in start hooks', async () => {
      const app = await defineApp(({ onApplicationStart }) => {
        onApplicationStart(() => {
          throw new Error('Start error');
        });
        
        return { test: true };
      });

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
      const app = await defineApp(({ onApplicationStop }) => {
        onApplicationStop(() => {
          throw new Error('Stop error');
        });
        
        return { test: true };
      });

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

      const app = await defineApp(({ onApplicationInitialized, onApplicationStart, onApplicationStop }) => {
        const database: DatabaseConnection = {
          connect: async () => { database.isConnected = true; },
          disconnect: async () => { database.isConnected = false; },
          isConnected: false
        };
        
        const server: WebServer = {
          start: async (port: number) => { server.isRunning = true; },
          stop: async () => { server.isRunning = false; },
          isRunning: false
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

        return {
          database,
          server,
          getStatus: () => ({
            database: database.isConnected,
            server: server.isRunning
          })
        };
      });

      // After creation, database should be connected
      assert.strictEqual(app.database.isConnected, true);
      assert.strictEqual(app.server.isRunning, false);

      // After start, server should be running
      await app.start();
      assert.strictEqual(app.database.isConnected, true);
      assert.strictEqual(app.server.isRunning, true);

      // After stop, both should be stopped (server first, then database)
      await app.stop();
      assert.strictEqual(app.database.isConnected, false);
      assert.strictEqual(app.server.isRunning, false);
    });

    it('should support dependency injection in app context', async () => {
      // Simulate creating services that would be injected
      const createLogger = () => ({
        info: (msg: string) => console.log(`INFO: ${msg}`),
        error: (msg: string) => console.error(`ERROR: ${msg}`)
      });
      
      const createConfig = () => ({
        port: 3000,
        database: { host: 'localhost', port: 5432 },
        jwt: { secret: 'test-secret' }
      });

      const app = await defineApp(({ onApplicationStart, onApplicationStop }) => {
        // In a real app, these would be created via defineService
        const logger = createLogger();
        const config = createConfig();
        
        onApplicationStart(() => {
          logger.info(`Starting application on port ${config.port}`);
        }, 200); // Use high execution order to avoid conflict with error test hooks
        
        onApplicationStop(() => {
          logger.info('Stopping application');
        }, 200);

        return {
          services: {
            logger,
            config
          },
          getPort: () => config.port,
          log: (message: string) => logger.info(message)
        };
      });

      assert.strictEqual(app.getPort(), 3000);
      assert.ok(app.services.logger);
      assert.ok(app.services.config);
      
      // Test that methods work
      app.log('Test message'); // Should not throw
    });
  });
});