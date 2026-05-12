import {
  Injectable,
  SCOPE,
  type InjectEntry,
  type ValidInjectEntries,
  type ToInjectObject,
} from './index.ts';
import { LOG_LEVEL, type LogLevel } from './log-level.ts';
import type { Scope } from './scope.ts';
import type { InjectableClass } from './types.ts';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

type LoggerInstance<TInject extends readonly InjectEntry[]> = {
  readonly inject: ToInjectObject<TInject>;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

type LoggerBase<
  TName extends string,
  TLevel extends LogLevel,
  TScope extends Scope,
  TInject extends readonly InjectEntry[],
> = InjectableClass<LoggerInstance<TInject>, TInject, TScope> & {
  readonly _isLogger: true;
  readonly _name: TName;
  readonly _level: TLevel;
};

export const Logger = <
  const TName extends string,
  const TLevel extends LogLevel = typeof LOG_LEVEL.INFO,
  const TScope extends typeof SCOPE.SINGLETON | typeof SCOPE.TRANSIENT | typeof SCOPE.REQUEST =
    typeof SCOPE.SINGLETON,
  const TInject extends readonly InjectEntry[] = readonly [],
>(config: {
  name: TName;
  level?: TLevel;
  scope?: TScope;
  inject?: ValidInjectEntries<TInject>;
}): LoggerBase<TName, TLevel, TScope, TInject> => {
  const level = (config.level ?? LOG_LEVEL.INFO) as TLevel;
  const scope = (config.scope ?? SCOPE.SINGLETON) as TScope;

  const Base = Injectable<TScope, TInject>({
    scope,
    inject: config.inject as ValidInjectEntries<TInject> | undefined,
  });

  return class extends Base {
    public static readonly _isLogger = true as const;
    public static readonly _name: TName = config.name;
    public static readonly _level: TLevel = level;

    public debug(...args: unknown[]): void {
      if (LOG_LEVEL_PRIORITY.DEBUG >= LOG_LEVEL_PRIORITY[level]) {
        console.debug(`[${config.name}]`, ...args);
      }
    }

    public info(...args: unknown[]): void {
      if (LOG_LEVEL_PRIORITY.INFO >= LOG_LEVEL_PRIORITY[level]) {
        console.info(`[${config.name}]`, ...args);
      }
    }

    public warn(...args: unknown[]): void {
      if (LOG_LEVEL_PRIORITY.WARN >= LOG_LEVEL_PRIORITY[level]) {
        console.warn(`[${config.name}]`, ...args);
      }
    }

    public error(...args: unknown[]): void {
      console.error(`[${config.name}]`, ...args);
    }
  };
};
