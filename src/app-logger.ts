import { appHooks } from './app-hooks.ts';
/**
 * @internal
 */
export type AppLogger = {
  error: (...args: any[]) => unknown;
  debug: (...args: any[]) => unknown;
  warn: (...args: any[]) => unknown;
  info: (...args: any[]) => unknown;
  trace: (...args: any[]) => unknown;
};

/**
 * @internal
 */
export let appLogger: AppLogger | undefined = undefined;

export const setAppLogger = (logger: AppLogger | undefined) => {
  appLogger = logger;
  appHooks.setLogger(logger);
};
