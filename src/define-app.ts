import { appHooks } from './app-hooks.ts';
import type { Module } from './define-module-factory.ts';
import { appLogger, setAppLogger, type Logger,setLoggerFactory,loggerFactory } from './app-logger.ts';

/**
 * Defines and initializes an application with lifecycle management.
 * Executes the provided function, fires initialization hooks, and returns control methods.
 * @template T - The type of the module returned by the function
 * @param fn - Function that returns a module to be initialized
 * @returns An object with start() and stop() methods for application lifecycle control
 */
export const defineApp = async <T extends Module<unknown>>(fn: () => T, options?: { name?: string, loggerFactory?: (name: string) => Logger }) => {
  setLoggerFactory(options?.loggerFactory);
  setAppLogger(loggerFactory?.(options?.name ?? 'app'))

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
