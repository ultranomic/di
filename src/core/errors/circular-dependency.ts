import type { Injectable, InjectableConstructor } from '../types/injectable.ts';
import { DependencyInjectionError } from './base.ts';

/**
 * Error thrown when a circular dependency cannot be resolved.
 *
 * Note: DI handles circular dependencies via proxy pattern by default.
 * This error is reserved for cases where circular resolution fails.
 *
 * @example
 * ```typescript
 * throw new CircularDependencyError(
 *   'ServiceA',
 *   ['ServiceA', 'ServiceB', 'ServiceA']
 * )
 * // Error message:
 * // CircularDependencyError: Circular dependency detected in 'ServiceA'
 * //   Dependency chain: ServiceA -> ServiceB -> ServiceA
 * //   Suggestion: Consider refactoring to break the cycle, or use lazy resolution.
 * ```
 */
export class CircularDependencyError extends DependencyInjectionError {
  /**
   * The token where the cycle was detected
   */
  readonly token: string;

  /**
   * The full dependency chain showing the cycle
   */
  readonly dependencyChain: string[];

  constructor(token: InjectableConstructor, dependencyChain: InjectableConstructor[]) {
    const tokenStr = typeof token === 'function' ? token.name : String(token);
    const chainStr = dependencyChain.map((t) => (typeof t === 'function' ? t.name : String(t)));

    super(
      `Circular dependency detected in '${tokenStr}'\n` +
        `  Dependency chain: ${chainStr.join(' -> ')}\n` +
        `  Suggestion: Consider refactoring to break the cycle, or use lazy resolution.`,
    );

    this.token = tokenStr;
    this.dependencyChain = chainStr;
  }
}
