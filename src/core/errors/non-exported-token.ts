import type { Injectable, InjectableConstructor } from '../types/injectable.ts';
import { DependencyInjectionError } from './base.ts';

/**
 * Error thrown when a module tries to access a token from an imported module
 * that is not exported
 */
export class NonExportedTokenError extends DependencyInjectionError {
  readonly token: InjectableConstructor;
  readonly requestingModule: string;
  readonly ownerModule: string;
  readonly exportedTokens: InjectableConstructor[];

  constructor(token: InjectableConstructor, requestingModule: InjectableConstructor | string, ownerModule: InjectableConstructor | string, exportedTokens: InjectableConstructor[]) {
    const tokenName = typeof token === 'function' ? token.name : String(token);
    const requestingName = typeof requestingModule === 'function' ? requestingModule.name : String(requestingModule);
    const ownerName = typeof ownerModule === 'function' ? ownerModule.name : String(ownerModule);
    const exportedNames = exportedTokens.map((t) => (typeof t === 'function' ? t.name : String(t)));

    super(
      `Token "${tokenName}" is not exported from module "${ownerName}". ` +
        `Module "${requestingName}" can only access exported tokens: ` +
        `[${exportedNames.length > 0 ? exportedNames.join(', ') : 'none'}]. ` +
        `Either export "${tokenName}" from "${ownerName}" or ` +
        `don't use it in "${requestingName}".`,
    );
    this.token = token;
    this.requestingModule = requestingName;
    this.ownerModule = ownerName;
    this.exportedTokens = exportedTokens;
  }
}
