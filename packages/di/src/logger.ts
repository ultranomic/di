import { Injectable } from './injectable.ts';
import type { ToInjectObject } from './injectable.ts';
import { LOG_LEVEL, type LogLevel } from './log-level.ts';
import { SCOPE } from './scope.ts';
import type { Scope } from './scope.ts';
import type { InjectEntry, ValidInjectEntries, InjectableClass } from './types.ts';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const formatTimestamp = (): string =>
  new Date().toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const formatLog = (level: LogLevel, name: string | undefined, args: unknown[]): unknown[] => {
  return [name ? `[${name}]` : '', formatTimestamp(), level, ...args].filter((v) => v !== '');
};

export type LoggerInstance<TInject extends readonly InjectEntry[] = readonly []> = {
  name?: string;
  level: LogLevel;
  readonly inject: ToInjectObject<TInject>;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

type LoggerBase<TScope extends Scope, TInject extends readonly InjectEntry[]> = InjectableClass<
  LoggerInstance<TInject>,
  TInject,
  TScope
> & {
  readonly _isLogger: true;
};

export const Logger = <
  const TScope extends typeof SCOPE.SINGLETON | typeof SCOPE.TRANSIENT | typeof SCOPE.REQUEST =
    typeof SCOPE.SINGLETON,
  const TInject extends readonly InjectEntry[] = readonly [],
>(config?: {
  name?: string;
  level?: LogLevel;
  scope?: TScope;
  inject?: ValidInjectEntries<TInject>;
}): LoggerBase<TScope, TInject> => {
  const scope = (config?.scope ?? SCOPE.SINGLETON) as TScope;

  const Base = Injectable<TScope, TInject>({
    scope,
    inject: config?.inject,
  });

  return class extends Base {
    public static readonly _isLogger = true as const;
    public name = config?.name;
    public level = config?.level ?? LOG_LEVEL.INFO;

    public debug(...args: unknown[]): void {
      if (LOG_LEVEL_PRIORITY.DEBUG >= LOG_LEVEL_PRIORITY[this.level]) {
        console.debug(...formatLog(LOG_LEVEL.DEBUG, this.name, args));
      }
    }

    public info(...args: unknown[]): void {
      if (LOG_LEVEL_PRIORITY.INFO >= LOG_LEVEL_PRIORITY[this.level]) {
        console.info(...formatLog(LOG_LEVEL.INFO, this.name, args));
      }
    }

    public warn(...args: unknown[]): void {
      if (LOG_LEVEL_PRIORITY.WARN >= LOG_LEVEL_PRIORITY[this.level]) {
        console.warn(...formatLog(LOG_LEVEL.WARN, this.name, args));
      }
    }

    public error(...args: unknown[]): void {
      console.error(...formatLog(LOG_LEVEL.ERROR, this.name, args));
    }
  };
};

const DefaultLoggerBase: LoggerBase<typeof SCOPE.SINGLETON, readonly []> = Logger();

export class DefaultLogger extends DefaultLoggerBase {
  public constructor(
    config: { name?: string; level?: LogLevel } = { name: 'DI', level: LOG_LEVEL.DEBUG },
  ) {
    super();
    this.name = config.name;
    this.level = config.level ?? LOG_LEVEL.DEBUG;
  }
}
