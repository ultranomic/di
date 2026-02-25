import type { Injectable, InjectableConstructor } from '../types/injectable.ts';
import { DependencyInjectionError } from './base.ts';

export class ScopeValidationError extends DependencyInjectionError {
  readonly parentToken: string;
  readonly scopedToken: string;

  constructor(parentToken: InjectableConstructor, scopedToken: InjectableConstructor) {
    const parentStr = typeof parentToken === 'function' ? parentToken.name : String(parentToken);
    const scopedStr = typeof scopedToken === 'function' ? scopedToken.name : String(scopedToken);

    super(
      `Scope validation failed: Singleton '${parentStr}' depends on scoped '${scopedStr}'. ` +
        `Singletons cannot depend on request-scoped providers because it would cause ` +
        `the scoped instance to be shared across all requests. ` +
        `Consider making '${parentStr}' scoped, or '${scopedStr}' singleton/transient.`,
    );

    this.parentToken = parentStr;
    this.scopedToken = scopedStr;
  }
}
