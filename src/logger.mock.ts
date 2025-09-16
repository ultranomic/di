import type { Logger } from 'pino';

/**
 * Creates a mock pino logger for testing purposes
 */
export const createMockLogger = (name = 'mock'): Logger => {
  const logs: Array<{ level: string; msg: string; prefix?: string }> = [];

  const createLogger = (prefix?: string): Logger =>
    ({
      // Standard pino log levels
      trace: (msg: string) => logs.push({ level: 'trace', msg, prefix: prefix || '' }),
      debug: (msg: string) => logs.push({ level: 'debug', msg, prefix: prefix || '' }),
      info: (msg: string) => logs.push({ level: 'info', msg, prefix: prefix || '' }),
      warn: (msg: string) => logs.push({ level: 'warn', msg, prefix: prefix || '' }),
      error: (msg: string) => logs.push({ level: 'error', msg, prefix: prefix || '' }),
      fatal: (msg: string) => logs.push({ level: 'fatal', msg, prefix: prefix || '' }),

      // Child logger creation
      child: (_bindings: any, options?: { msgPrefix?: string }) => {
        return createLogger(options?.msgPrefix || prefix);
      },

      // Test utility to get logs
      getLogs: () => logs,
      clearLogs: () => logs.splice(0, logs.length),

      // Required pino properties (minimal implementation)
      level: 'info',
      levelVal: 30,
      useLevelLabels: false,
      useOnlyCustomLevels: false,

      // These are required by the Logger interface but not used in our tests
      silent: false,
      onChild: undefined as any,
      bindings: () => ({}),
      hasLevel: () => true,
      isLevelEnabled: () => true,
      version: '1.0.0',

      // Placeholders for other required methods
      flush: () => {},
      addLevel: () => true,
      setBindings: () => {},
    }) as unknown as Logger & { getLogs: () => any[]; clearLogs: () => void };

  return createLogger('');
};
