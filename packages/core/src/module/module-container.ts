import type { ContainerInterface, ResolverInterface } from '../container/interfaces.ts';
import type { InferInject } from '../types/deps.ts';
import { NonExportedTokenError } from '../errors/non-exported-token.ts';
import type { Token } from '../types/token.ts';

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

  register<T>(
    token: Token<T>,
    factory: (container: ResolverInterface) => T,
  ): import('../container/binding.ts').BindingBuilder<T> {
    // Track this token as belonging to this module
    const isExported = this.currentModuleExports.has(token);
    this.trackToken(token, isExported);

    // Wrap the factory to ensure it uses this container for resolution
    const wrappedFactory = (_resolver: ResolverInterface) => {
      return factory(this);
    };

    return this.baseContainer.register(token, wrappedFactory);
  }

  resolve<T>(token: Token<T>): T {
    // Check if this token has an owner and if it's accessible
    const owner = this.allModulesOwners.get(token);

    if (owner && owner.module !== this.moduleName) {
      // Token is from a different module - check if we can access it

      // First check if the module is accessible (imported)
      if (!this.accessibleModules.has(owner.module)) {
        // The module isn't even imported - get all exported tokens from accessible modules
        const accessibleTokens = this.getAccessibleTokens();
        throw new NonExportedTokenError(token, this.moduleName, owner.module, accessibleTokens);
      }

      // Module is imported - now check if token is exported
      if (!owner.isExported) {
        // Module is imported but token isn't exported
        const exportedTokens = this.getExportedTokensForModule(owner.module);
        throw new NonExportedTokenError(token, this.moduleName, owner.module, exportedTokens);
      }
    }

    return this.baseContainer.resolve(token);
  }

  /**
   * Get all tokens that are accessible from this module
   * (tokens from imported modules that are exported)
   */
  private getAccessibleTokens(): Token[] {
    const accessible: Token[] = [];
    for (const [token, owner] of this.allModulesOwners) {
      if (owner.module !== this.moduleName && this.accessibleModules.has(owner.module) && owner.isExported) {
        accessible.push(token);
      }
    }
    return accessible;
  }

  has(token: Token): boolean {
    // Only return true for tokens that are accessible from this module
    const owner = this.allModulesOwners.get(token);

    if (!owner) {
      // No owner yet, defer to base container
      return this.baseContainer.has(token);
    }

    if (owner.module === this.moduleName) {
      // Our own token - always accessible
      return this.baseContainer.has(token);
    }

    // From another module - check if exported and module is accessible
    if (!this.accessibleModules.has(owner.module)) {
      return false;
    }

    return owner.isExported && this.baseContainer.has(token);
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
    const exported: Token[] = [];
    for (const [token, owner] of this.allModulesOwners) {
      if (owner.module === moduleName && owner.isExported) {
        exported.push(token);
      }
    }
    return exported;
  }
}
