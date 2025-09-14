import { appHooks } from './app-hooks.ts';
/**
 * @internal
 */
export type Logger = {
  error: (...args: any[]) => unknown;
  debug: (...args: any[]) => unknown;
  warn: (...args: any[]) => unknown;
  info: (...args: any[]) => unknown;
  trace: (...args: any[]) => unknown;
};

/**
 * @internal
 */
export let appLogger: Logger | undefined = undefined;

export const setAppLogger = (logger: Logger | undefined) => {
  appLogger = logger;
  appHooks.setLogger(logger);
};

/**
 * Logger factory function that creates named loggers for injectables.
 * @internal
 */
export let loggerFactory: ((name: string) => Logger) | undefined = undefined;

/**
 * Sets the logger factory function used to create named loggers for injectables.
 * @param factory - Optional function that creates a logger instance for a given component name
 * @internal
 */
export const setLoggerFactory = (factory?: (name: string) => Logger) => {
  loggerFactory = factory;
};
