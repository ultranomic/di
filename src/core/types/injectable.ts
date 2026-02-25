/**
 * Injectable types for dependency injection
 *
 * Provides the abstract base class that all injectable services must extend.
 */

/**
 * Abstract base class for all injectable services and providers.
 *
 * All classes that can be dependency injected must extend this class.
 * This ensures compile-time type safety that only explicitly marked
 * classes can be used as injection tokens.
 *
 * @example
 * class Logger extends Injectable {
 *   log(message: string) {
 *     console.log(message);
 *   }
 * }
 *
 * class UserService extends Injectable {
 *   static readonly inject = [Logger] as const satisfies DependencyTokens<typeof this>;
 *
 *   constructor(private logger: Logger) {}
 *
 *   getUser(id: string) {
 *     this.logger.log(`Getting user ${id}`);
 *     return { id, name: 'John' };
 *   }
 * }
 */
export abstract class Injectable {
  /**
   * Static dependencies array for constructor injection.
   *
   * Use the array-based inject pattern with individual constructor parameters.
   *
   * @example
   * static readonly inject = [Logger, Database] as const satisfies DependencyTokens<typeof MyService>;
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static readonly inject?: readonly Injectable[];
}
