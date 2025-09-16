import { appHooks } from './app-hooks.ts';
import type { Logger } from 'pino';

/**
 * @internal
 */
export let appLogger: Logger | undefined = undefined;

/**
 * Sets the application-wide logger instance and configures it for app hooks.
 * This logger will be used as the parent for all component-specific child loggers.
 * @param logger - The pino logger instance to use for application logging, or undefined to disable logging
 * @internal
 */
export const setAppLogger = (logger: Logger | undefined) => {
  appLogger = logger;
  appHooks.setLogger(logger);
};
