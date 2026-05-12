/** Logger level constants: `Debug`, `Info`, `Warn`, and `Error`. */
export const LOG_LEVEL = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;

/** Union type of all valid logger level values. */
export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];
