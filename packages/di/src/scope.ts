/** Provider lifecycle scope constants: `Singleton`, `Transient`, and `Request`. */
export const SCOPE = Object.freeze({
  SINGLETON: 'SINGLETON',
  TRANSIENT: 'TRANSIENT',
  REQUEST: 'REQUEST',
} as const);
/** Union type of all valid provider lifecycle scope values. */
export type Scope = (typeof SCOPE)[keyof typeof SCOPE];
