import { createAsyncHooks } from '@ultranomic/hook';
import type { Module } from './define-module-factory.ts';

/**
 * Global application hooks instance that manages the three-phase application lifecycle.
 * This provides centralized lifecycle management for the entire application.
 *
 * Lifecycle phases:
 * - onApplicationInitialized: Fired during app creation, after user setup but before returning app instance
 * - onApplicationStart: Fired when app.start() is called
 * - onApplicationStop: Fired when app.stop() is called
 *
 * @internal
 */
export const appHooks = createAsyncHooks<{
  onApplicationInitialized: [];
  onApplicationStart: [];
  onApplicationStop: [];
}>({ logger: console });

/**
 * Registers a callback to be executed during application initialization.
 * This hook fires during app creation, after user configuration but before the app instance is returned.
 *
 * @param fn - Callback function to execute during initialization
 * @param executionOrder - Order of execution (lower numbers execute first, default: 0)
 * @example
 * ```typescript
 * onApplicationInitialized(() => {
 *   console.log('App is being initialized');
 * });
 * ```
 */
export const onApplicationInitialized = (fn: () => unknown, executionOrder = 0) =>
  appHooks.register('onApplicationInitialized', fn, executionOrder);

/**
 * Registers a callback to be executed when the application starts.
 * This hook fires when app.start() is called.
 *
 * @param fn - Callback function to execute during application startup
 * @param executionOrder - Order of execution (lower numbers execute first, default: 0)
 * @example
 * ```typescript
 * onApplicationStart(() => {
 *   console.log('App is starting');
 * });
 * ```
 */
export const onApplicationStart = (fn: () => unknown, executionOrder = 0) =>
  appHooks.register('onApplicationStart', fn, executionOrder);

/**
 * Registers a callback to be executed when the application stops.
 * This hook fires when app.stop() is called.
 *
 * @param fn - Callback function to execute during application shutdown
 * @param executionOrder - Order of execution (lower numbers execute first, default: 0)
 * @example
 * ```typescript
 * onApplicationStop(() => {
 *   console.log('App is stopping');
 * });
 * ```
 */
export const onApplicationStop = (fn: () => unknown, executionOrder = 0) =>
  appHooks.register('onApplicationStop', fn, executionOrder);

/**
 * Creates the main application instance with comprehensive lifecycle management.
 * This is the top-level orchestration utility that takes a module factory and creates the actual application instance.
 *
 * The application follows a three-phase lifecycle:
 * 1. **Initialization**: App module is created, then onApplicationInitialized hooks fire
 * 2. **Start**: Call app.start() to fire onApplicationStart hooks
 * 3. **Stop**: Call app.stop() to fire onApplicationStop hooks
 *
 * Key features:
 * - Automatic initialization phase during app creation
 * - Manual start/stop control via returned methods
 * - Async hook support with execution ordering
 * - Type-safe integration with module components
 * - Built-in error handling and logging
 *
 * @template T - The type of the module factory (must extend Module)
 * @param appModule - The main application module factory that orchestrates all app components
 * @returns Promise that resolves to the actual application instance with start() and stop() methods
 *
 * @example
 * ```typescript
 * // Create module factory
 * const defineAppModule = defineModule.handler(() => {
 *   const userModule = defineUserModule(); // Creates module instance
 *   const userRouter = defineUserRouter(); // Creates router instance
 *   return {
 *     userRouter
 *   };
 * });
 *
 * // Create actual app instance using the module factory
 * const app = await defineApp(defineAppModule);
 * await app.start();
 *
 * // Later, stop the application
 * await app.stop();
 *
 * // Complex app module with lifecycle management
 * const defineAppModule = defineModule
 *   .inject<{ database: Service<DatabaseType>; logger: Service<LoggerType> }>()
 *   .handler((injector, { onApplicationInitialized, onApplicationStart, onApplicationStop }) => {
 *     const { database, logger } = injector();
 *
 *     // Register lifecycle hooks
 *     onApplicationInitialized(async () => {
 *       await database.migrate();
 *       logger.info('Database migrations completed');
 *     });
 *
 *     onApplicationStart(async () => {
 *       await database.connect();
 *       logger.info('Database connected');
 *     }, 1);
 *
 *     onApplicationStart(() => {
 *       logger.info('Starting HTTP server');
 *     }, 2);
 *
 *     onApplicationStop(async () => {
 *       logger.info('Stopping HTTP server');
 *     }, 1);
 *
 *     onApplicationStop(async () => {
 *       await database.disconnect();
 *       logger.info('Database disconnected');
 *     }, 2);
 *
 *     return {
 *       userModule: defineUserModule(),
 *       userRouter: defineUserRouter()
 *     };
 *   });
 *
 * const app = await defineApp(defineAppModule);
 * await app.start();
 * await app.stop();
 * ```
 */
export const defineApp = async <T extends Module<unknown>>(fn: () => T) => {
  await Promise.try(fn);
  await appHooks.fire('onApplicationInitialized');

  return (() => {
    return {
      start: () => appHooks.fire('onApplicationStart'),
      stop: () => appHooks.fire('onApplicationStop'),
    };
  })();
};
