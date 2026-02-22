import type { Token } from '../types/token.js'
import { VoxelError } from './base.js'

/**
 * Error thrown when a token cannot be resolved in the container.
 *
 * Provides detailed context including the resolution path and available tokens
 * to help developers quickly identify missing dependencies or misconfigured modules.
 *
 * @example
 * ```typescript
 * throw new TokenNotFoundError(
 *   'Logger',
 *   ['App', 'UserModule', 'UserService'],
 *   ['Database', 'Config', 'Cache']
 * )
 * // Error message:
 * // TokenNotFoundError: Token 'Logger' not found
 * //   Resolution path: App -> UserModule -> UserService -> Logger
 * //   Available tokens: Database, Config, Cache
 * //   Suggestion: Did you mean to import a module that provides 'Logger'?
 * ```
 */
export class TokenNotFoundError extends VoxelError {
  /**
   * The token that could not be found
   */
  readonly token: string

  /**
   * The resolution path showing which dependencies led to this token
   */
  readonly resolutionPath: string[]

  /**
   * List of tokens that are available in the container
   */
  readonly availableTokens: string[]

  constructor(
    token: Token,
    resolutionPath: string[],
    availableTokens: string[],
  ) {
    const tokenStr = typeof token === 'function' ? token.name : String(token)

    const pathSection =
      resolutionPath.length > 0
        ? `\n  Resolution path: ${resolutionPath.join(' -> ')} -> ${tokenStr}`
        : ''

    const availableSection =
      availableTokens.length > 0
        ? `\n  Available tokens: ${availableTokens.join(', ')}`
        : '\n  Available tokens: (none registered)'

    const suggestion = `\n  Suggestion: Did you mean to import a module that provides '${tokenStr}'?`

    super(`Token '${tokenStr}' not found${pathSection}${availableSection}${suggestion}`)

    this.token = tokenStr
    this.resolutionPath = resolutionPath
    this.availableTokens = availableTokens
  }
}
