/**
 * Token types for dependency injection
 *
 * Tokens are used to identify providers in the DI container.
 * They must be class constructors (abstract or concrete).
 */

/**
 * Token type for provider identification
 *
 * @template T - The type of the value the token resolves to
 *
 * @example
 * // Abstract class token
 * abstract class LoggerBase {
 *   abstract log(message: string): void;
 * }
 * const loggerToken: Token<LoggerBase> = LoggerBase
 *
 * @example
 * // Concrete class token
 * class Database {
 *   connect(): void {
 *     // ...
 *   }
 * }
 * const dbToken: Token<Database> = Database
 */
// oxlint-disable-next-line typescript-eslint/no-explicit-any
export type Token<T = unknown> = abstract new (...args: any[]) => T;
