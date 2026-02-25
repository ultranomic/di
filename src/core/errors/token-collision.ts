import type { Injectable, InjectableConstructor } from '../types/injectable.ts';
import { DependencyInjectionError } from './base.ts';

/**
 * Error thrown when a token is registered more than once.
 *
 * Provides context about both the original and duplicate registrations
 * to help developers identify the source of the conflict.
 *
 * @example
 * ```typescript
 * throw new TokenCollisionError(
 *   'Logger',
 *   ConsoleLogger,
 *   FileLogger
 * )
 * // Error message:
 * // TokenCollisionError: Token 'Logger' is already registered
 * //   Original: ConsoleLogger
 * //   Duplicate: FileLogger
 * //   Suggestion: Each token should only be registered once.
 * ```
 */
export class TokenCollisionError extends DependencyInjectionError {
  /**
   * The token that was registered twice
   */
  readonly token: string;

  /**
   * The first implementation that was registered
   */
  readonly originalSource: string;

  /**
   * The second implementation that attempted to register
   */
  readonly duplicateSource: string;

  constructor(token: InjectableConstructor, originalSource: InjectableConstructor | string, duplicateSource: InjectableConstructor | string) {
    const tokenStr = typeof token === 'function' ? token.name : String(token);
    const originalStr = typeof originalSource === 'function' ? originalSource.name : String(originalSource);
    const duplicateStr = typeof duplicateSource === 'function' ? duplicateSource.name : String(duplicateSource);

    super(
      `Token '${tokenStr}' is already registered\n` +
        `  Original: ${originalStr}\n` +
        `  Duplicate: ${duplicateStr}\n` +
        `  Suggestion: Each token should only be registered once. ` +
        `Use a different token or remove the duplicate registration.`,
    );

    this.token = tokenStr;
    this.originalSource = originalStr;
    this.duplicateSource = duplicateStr;
  }
}
