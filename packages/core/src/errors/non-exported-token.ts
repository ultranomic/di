import type { Token } from '../types/token.ts';

/**
 * Error thrown when a module tries to access a token from an imported module
 * that is not exported
 */
export class NonExportedTokenError extends Error {
  readonly token: Token;
  readonly requestingModule: string;
  readonly ownerModule: string;
  readonly exportedTokens: Token[];

  constructor(
    token: Token,
    requestingModule: string,
    ownerModule: string,
    exportedTokens: Token[],
  ) {
    const tokenName = typeof token === 'function' ? token.name : String(token);
    const exportedNames = exportedTokens.map((t) => (typeof t === 'function' ? t.name : String(t)));

    super(
      `Token "${tokenName}" is not exported from module "${ownerModule}". ` +
        `Module "${requestingModule}" can only access exported tokens: ` +
        `[${exportedNames.length > 0 ? exportedNames.join(', ') : 'none'}]. ` +
        `Either export "${tokenName}" from "${ownerModule}" or ` +
        `don't use it in "${requestingModule}".`,
    );
    this.name = 'NonExportedTokenError';
    this.token = token;
    this.requestingModule = requestingModule;
    this.ownerModule = ownerModule;
    this.exportedTokens = exportedTokens;
  }
}
