import { createAsyncHooks } from '@ultranomic/hook';
/**
 * @internal
 * Application lifecycle hooks for managing application initialization, startup, and shutdown events.
 * Provides async hook management with execution ordering support.
 */
export const appHooks = createAsyncHooks<{
  onApplicationInitialized: [];
  onApplicationStart: [];
  onApplicationStop: [];
}>();

/**
 * @internal
 * Registers a callback to be executed when the application is initialized.
 * @param fn - The callback function to execute
 * @param executionOrder - The order of execution (lower numbers execute first)
 */
export const onApplicationInitialized = (fn: () => unknown, executionOrder = 0) =>
  appHooks.register('onApplicationInitialized', fn, executionOrder);

/**
 * @internal
 * Registers a callback to be executed when the application starts.
 * @param fn - The callback function to execute
 * @param executionOrder - The order of execution (lower numbers execute first)
 */
export const onApplicationStart = (fn: () => unknown, executionOrder = 0) =>
  appHooks.register('onApplicationStart', fn, executionOrder);

/**
 * @internal
 * Registers a callback to be executed when the application stops.
 * @param fn - The callback function to execute
 * @param executionOrder - The order of execution (lower numbers execute first)
 */
export const onApplicationStop = (fn: () => unknown, executionOrder = 0) =>
  appHooks.register('onApplicationStop', fn, executionOrder);
