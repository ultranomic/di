import { appHooks } from './app-hooks.ts';
import type { Module } from './define-module-factory.ts';

export type Logger = {
  error: (...args: any[]) => unknown;
  debug: (...args: any[]) => unknown;
  warn: (...args: any[]) => unknown;
  info: (...args: any[]) => unknown;
  trace: (...args: any[]) => unknown;
};

/**
 * Defines and initializes an application with lifecycle management.
 * Executes the provided function, fires initialization hooks, and returns control methods.
 * @template T - The type of the module returned by the function
 * @param fn - Function that returns a module to be initialized
 * @returns An object with start() and stop() methods for application lifecycle control
 */
export const defineApp = async <T extends Module<unknown>>(fn: () => T, options?: { logger?: Logger }) => {
  appHooks.setLogger(options?.logger);

  await Promise.try(fn);
  await appHooks.fire('onApplicationInitialized');

  return (() => {
    return {
      start: () => appHooks.fire('onApplicationStart'),
      stop: () => appHooks.fire('onApplicationStop'),
    };
  })();
};
