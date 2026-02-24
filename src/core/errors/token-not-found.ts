import type { Token } from '../types/token.ts';
import { VoxelError } from './base.ts';

/**
 * Error thrown when a token cannot be resolved in the container.
 *
 * Provides detailed context including the resolution path and available tokens
 * to help developers quickly identify missing dependencies or misconfigured modules.
 *
 * @example
 * ```typescript
 * class Logger {}
 * class App {}
 * class Database {}
 * throw new TokenNotFoundError(
 *   Logger,
 *   [App, UserService],
 *   [Database, Config, Cache]
 * )
 * // Error message:
 * // TokenNotFoundError: Token 'Logger' not found
 * //   Resolution path: App -> UserService -> Logger
 * //   Available tokens: Database, Config, Cache
 * //   Suggestion: Did you mean to import a module that provides 'Logger'?
 * ```
 */
export class TokenNotFoundError extends VoxelError {
  /**
   * The token that could not be found
   */
  readonly token: string;

  /**
   * The resolution path showing which dependencies led to this token
   */
  readonly resolutionPath: string[];

  /**
   * List of tokens that are available in the container
   */
  readonly availableTokens: string[];

  constructor(token: Token, resolutionPath: Token[], availableTokens: Token[]) {
    const tokenStr = typeof token === 'function' ? token.name : String(token);
    const pathStr = resolutionPath.map((t) => (typeof t === 'function' ? t.name : String(t)));
    const availableStr = availableTokens.map((t) => (typeof t === 'function' ? t.name : String(t)));

    const pathSection =
      resolutionPath.length > 0 ? `\n  Resolution path: ${pathStr.join(' -> ')} -> ${tokenStr}` : '';

    const availableSection =
      availableTokens.length > 0
        ? `\n  Available tokens: ${availableStr.join(', ')}`
        : '\n  Available tokens: (none registered)';

    const suggestion = `\n  Suggestion: Did you mean to import a module that provides '${tokenStr}'?`;

    super(`Token '${tokenStr}' not found${pathSection}${availableSection}${suggestion}`);

    this.token = tokenStr;
    this.resolutionPath = pathStr;
    this.availableTokens = availableStr;
  }
}
