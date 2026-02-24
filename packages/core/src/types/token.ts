/**
 * Token types for dependency injection
 *
 * Tokens are used to identify providers in the DI container.
 * They can be strings, symbols, or abstract class constructors.
 */

/**
 * Token type for provider identification
 *
 * @template T - The type of the value the token resolves to (for class tokens)
 *
 * @example
 * // String token
 * const loggerToken: Token = 'Logger'
 *
 * @example
 * // Symbol token
 * const dbToken: Token = Symbol('Database')
 *
 * @example
 * // Class token
 * abstract class LoggerBase {}
 * const loggerToken: Token<LoggerBase> = LoggerBase
 */
// oxlint-disable-next-line typescript-eslint(no-explicit-any)
export type Token<T = unknown> = string | symbol | (abstract new (...args: any[]) => T);

/**
 * Token registry interface for declaration merging
 *
 * Users can extend this interface to add type-safe token mappings:
 *
 * @example
 * declare module '@voxeljs/core' {
 *   interface TokenRegistry {
 *     Logger: ConsoleLogger
 *     Database: PostgresDatabase
 *   }
 * }
 *
 * // Then tokens like 'Logger' will be typed to ConsoleLogger
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TokenRegistry {
  // Intentionally empty - for declaration merging
}
