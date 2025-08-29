import { createAsyncHooks } from '@ultranomic/hook';

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
 * This is the top-level orchestration utility that brings together all your services, modules, and routers.
 * 
 * The application follows a three-phase lifecycle:
 * 1. **Initialization**: User setup code runs, then onApplicationInitialized hooks fire
 * 2. **Start**: Call app.start() to fire onApplicationStart hooks
 * 3. **Stop**: Call app.stop() to fire onApplicationStop hooks
 * 
 * Key features:
 * - Automatic initialization phase during app creation
 * - Manual start/stop control via returned methods
 * - Async hook support with execution ordering
 * - Type-safe integration with all injectable components
 * - Built-in error handling and logging
 * 
 * @template T - The type of the application object (must extend object)
 * @param fn - Function that configures the application and returns the app object
 * @param fn.onApplicationInitialized - Hook registrar for initialization callbacks
 * @param fn.onApplicationStart - Hook registrar for start callbacks
 * @param fn.onApplicationStop - Hook registrar for stop callbacks
 * @returns Promise that resolves to the application instance with start() and stop() methods
 * 
 * @example
 * ```typescript
 * // Simple application
 * const app = await defineApp(() => ({
 *   name: 'My App',
 *   version: '1.0.0'
 * }));
 * 
 * await app.start();
 * // ... app is running
 * await app.stop();
 * 
 * // Complex application with lifecycle management
 * const app = await defineApp(({ onApplicationInitialized, onApplicationStart, onApplicationStop }) => {
 *   // Setup your services, modules, routers
 *   const database = createDatabaseService();
 *   const userService = createUserService(database);
 *   const userRouter = createUserRouter(userService);
 *   
 *   // Register lifecycle hooks
 *   onApplicationInitialized(async () => {
 *     await database.migrate();
 *     console.log('Database migrations completed');
 *   });
 *   
 *   onApplicationStart(async () => {
 *     await database.connect();
 *     console.log('Database connected');
 *   }, 1);
 *   
 *   onApplicationStart(() => {
 *     console.log('Starting HTTP server');
 *   }, 2);
 *   
 *   onApplicationStop(async () => {
 *     console.log('Stopping HTTP server');
 *   }, 1);
 *   
 *   onApplicationStop(async () => {
 *     await database.disconnect();
 *     console.log('Database disconnected');
 *   }, 2);
 *   
 *   return {
 *     name: 'My App',
 *     version: '1.0.0',
 *     database,
 *     services: { userService },
 *     routers: { userRouter }
 *   };
 * });
 * 
 * // Start the application (triggers start hooks in order)
 * await app.start();
 * 
 * // Access app components
 * console.log(app.name); // "My App"
 * const user = await app.services.userService.getUser('123');
 * 
 * // Stop the application (triggers stop hooks in order)
 * await app.stop();
 * ```
 */
export const defineApp = async <T extends object>(
  fn: (options: {
    onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
    onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
    onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
  }) => T,
) => {
  const app = fn({ onApplicationStart, onApplicationStop, onApplicationInitialized });
  await appHooks.fire('onApplicationInitialized');

  return (() => {
    return {
      ...app,
      start: () => appHooks.fire('onApplicationStart'),
      stop: () => appHooks.fire('onApplicationStop'),
    };
  })();
};
