import { createAsyncHooks } from '@ultranomic/hook';
import type { Module } from './define-module-factory.ts';

/**
 * Application lifecycle hooks for managing application initialization, startup, and shutdown events.
 * Provides async hook management with execution ordering support.
 */
export const appHooks = createAsyncHooks<{
  onApplicationInitialized: [];
  onApplicationStart: [];
  onApplicationStop: [];
}>({ logger: console });

/**
 * Registers a callback to be executed when the application is initialized.
 * @param fn - The callback function to execute
 * @param executionOrder - The order of execution (lower numbers execute first)
 */
export const onApplicationInitialized = (fn: () => unknown, executionOrder = 0) =>
  appHooks.register('onApplicationInitialized', fn, executionOrder);

/**
 * Registers a callback to be executed when the application starts.
 * @param fn - The callback function to execute
 * @param executionOrder - The order of execution (lower numbers execute first)
 */
export const onApplicationStart = (fn: () => unknown, executionOrder = 0) =>
  appHooks.register('onApplicationStart', fn, executionOrder);

/**
 * Registers a callback to be executed when the application stops.
 * @param fn - The callback function to execute
 * @param executionOrder - The order of execution (lower numbers execute first)
 */
export const onApplicationStop = (fn: () => unknown, executionOrder = 0) =>
  appHooks.register('onApplicationStop', fn, executionOrder);

/**
 * Defines and initializes an application with lifecycle management.
 * Executes the provided function, fires initialization hooks, and returns control methods.
 * @template T - The type of the module returned by the function
 * @param fn - Function that returns a module to be initialized
 * @returns An object with start() and stop() methods for application lifecycle control
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
