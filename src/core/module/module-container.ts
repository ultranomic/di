import type { ContainerInterface, ResolverInterface } from '../container/interfaces.ts';
import { Container } from '../container/container.ts';
import type { InferInject } from '../types/deps.ts';
import { NonExportedTokenError } from '../errors/non-exported-token.ts';
import type { Token } from '../types/token.ts';
import type { RegisterOptions } from '../container/binding.ts';

/**
 * Information about a token's owner module
 */
interface TokenOwner {
  module: string; // Module constructor name
  isExported: boolean;
}

/**
 * ModuleContainer wraps a Container to track token ownership and enforce encapsulation
 *
 * This container is created per-module during the loading process and ensures that
 * modules can only access tokens from their imported modules that are explicitly exported.
 */
export class ModuleContainer implements ContainerInterface {
  private readonly tokenOwners = new Map<Token, TokenOwner>();
  private readonly moduleName: string;
  private readonly currentModuleExports: Set<Token>;
  private readonly accessibleModules: Set<string>;
  private readonly baseContainer: ContainerInterface;
  private readonly allModulesOwners: Map<Token, TokenOwner>;

  constructor(
    baseContainer: ContainerInterface,
    moduleName: string,
    moduleExports: readonly Token[],
    allModulesOwners: Map<Token, TokenOwner>,
  ) {
    this.baseContainer = baseContainer;
    this.moduleName = moduleName;
    this.currentModuleExports = new Set(moduleExports);
    this.allModulesOwners = allModulesOwners;
    this.accessibleModules = new Set();
    this.accessibleModules.add(moduleName); // A module can always access its own tokens
  }

  /**
   * Add an accessible module (one that was imported)
   */
  addAccessibleModule(moduleName: string): void {
    this.accessibleModules.add(moduleName);
  }

  /**
   * Track a token that was registered in this module
   */
  trackToken(token: Token, isExported: boolean): void {
    const owner: TokenOwner = {
      module: this.moduleName,
      isExported,
    };
    this.tokenOwners.set(token, owner);
    this.allModulesOwners.set(token, owner);
  }

  register<T extends abstract new (...args: unknown[]) => unknown>(
    token: T,
    options?: RegisterOptions,
  ): void {
    const isExported = this.currentModuleExports.has(token);
    this.trackToken(token, isExported);
    this.baseContainer.register(token, options);
  }

  resolve<T>(token: Token<T>): T {
    const owner = this.allModulesOwners.get(token);

    // Check if this token is from another module and validate access
    if (owner !== undefined && owner.module !== this.moduleName) {
      this.validateTokenAccess(token, owner);
    }

    // Use resolveWithExternalResolver if the base container supports it (for encapsulation during auto-instantiation)
    if (this.baseContainer instanceof Container) {
      return this.baseContainer.resolveWithExternalResolver(token, this as ResolverInterface);
    }

    return this.baseContainer.resolve(token);
  }

  /**
   * Validate that the current module can access a token from another module
   */
  private validateTokenAccess(token: Token, owner: TokenOwner): void {
    // Check if the module is accessible (imported)
    if (!this.accessibleModules.has(owner.module)) {
      const accessibleTokens = this.getAccessibleTokens();
      throw new NonExportedTokenError(token, this.moduleName, owner.module, accessibleTokens);
    }

    // Check if token is exported from the imported module
    if (!owner.isExported) {
      const exportedTokens = this.getExportedTokensForModule(owner.module);
      throw new NonExportedTokenError(token, this.moduleName, owner.module, exportedTokens);
    }
  }

  /**
   * Get all tokens that are accessible from this module
   * (tokens from imported modules that are exported)
   */
  private getAccessibleTokens(): Token[] {
    return Array.from(this.allModulesOwners.entries())
      .filter(([, owner]) => owner.module !== this.moduleName && this.accessibleModules.has(owner.module) && owner.isExported)
      .map(([token]) => token);
  }

  has(token: Token): boolean {
    const owner = this.allModulesOwners.get(token);

    // No owner yet, defer to base container
    if (owner === undefined) {
      return this.baseContainer.has(token);
    }

    // Our own token - always accessible
    if (owner.module === this.moduleName) {
      return this.baseContainer.has(token);
    }

    // From another module - check if exported and module is accessible
    return this.accessibleModules.has(owner.module) && owner.isExported && this.baseContainer.has(token);
  }

  getBinding<T>(token: Token<T>): import('../container/binding.ts').Binding<T> | undefined {
    return this.baseContainer.getBinding(token);
  }

  buildDeps<TTokens extends readonly Token[]>(tokens: TTokens): InferInject<TTokens> {
    const resolvedTokens = tokens.map((token) => this.resolve(token));
    return resolvedTokens as InferInject<TTokens>;
  }

  clear(): void {
    this.baseContainer.clear();
  }

  private getExportedTokensForModule(moduleName: string): Token[] {
    return Array.from(this.allModulesOwners.entries())
      .filter(([, owner]) => owner.module === moduleName && owner.isExported)
      .map(([token]) => token);
  }
}
