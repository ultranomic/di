import { appHooks } from './app-hooks.ts';
import type { Module } from './define-module-factory.ts';
import { appLogger, setAppLogger } from './app-logger.ts';
import type { Logger } from 'pino';

/**
 * Defines and initializes an application with lifecycle management.
 * Executes the provided function, fires initialization hooks, and returns control methods.
 * @template T - The type of the module returned by the function
 * @param fn - Function that returns a module to be initialized
 * @param options - Configuration options for the application
 * @param options.logger - Optional pino logger instance to use for application and component logging
 * @returns An object with start() and stop() methods for application lifecycle control
 */
export const defineApp = async <T extends Module<unknown>>(fn: () => T, options?: { logger?: Logger }) => {
  setAppLogger(options?.logger);

  await Promise.try(fn);
  await appHooks.fire('onApplicationInitialized');
  appLogger?.info('Application initialized');

  return (() => {
    return {
      start: () => appHooks.fire('onApplicationStart'),
      stop: () => appHooks.fire('onApplicationStop'),
    };
  })();
};
