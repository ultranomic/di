import { describe, expect, it } from 'vitest';
import { CircularDependencyError, ScopeValidationError, TokenCollisionError, TokenNotFoundError, VoxelError } from '../index.ts';
import { NonExportedTokenError } from './non-exported-token.ts';

describe('VoxelError', () => {
  it('should set error name to class name', () => {
    class TestError extends VoxelError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error.name).toBe('TestError');
  });

  it('should extend Error', () => {
    class TestError extends VoxelError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(VoxelError);
  });

  it('should have message property', () => {
    class TestError extends VoxelError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error.message).toBe('test message');
  });
});

describe('TokenNotFoundError', () => {
  it('should create error with token name', () => {
    const error = new TokenNotFoundError('Logger', [], []);
    expect(error.message).toContain("Token 'Logger' not found");
  });

  it('should include resolution path when provided', () => {
    const error = new TokenNotFoundError('Logger', ['App', 'UserModule', 'UserService'], []);
    expect(error.message).toContain('Resolution path: App -> UserModule -> UserService -> Logger');
  });

  it('should not include resolution path when empty', () => {
    const error = new TokenNotFoundError('Logger', [], []);
    expect(error.message).not.toContain('Resolution path:');
  });

  it('should include available tokens when provided', () => {
    const error = new TokenNotFoundError('Logger', [], ['Database', 'Config', 'Cache']);
    expect(error.message).toContain('Available tokens: Database, Config, Cache');
  });

  it('should show none registered when no available tokens', () => {
    const error = new TokenNotFoundError('Logger', [], []);
    expect(error.message).toContain('Available tokens: (none registered)');
  });

  it('should include helpful suggestion', () => {
    const error = new TokenNotFoundError('Logger', [], []);
    expect(error.message).toContain("Suggestion: Did you mean to import a module that provides 'Logger'?");
  });

  it('should format complete error message correctly', () => {
    const error = new TokenNotFoundError('Logger', ['App', 'UserService'], ['Database', 'Config']);

    const expected = `Token 'Logger' not found
  Resolution path: App -> UserService -> Logger
  Available tokens: Database, Config
  Suggestion: Did you mean to import a module that provides 'Logger'?`;

    expect(error.message).toBe(expected);
  });

  it('should store token property', () => {
    const error = new TokenNotFoundError('Logger', [], []);
    expect(error.token).toBe('Logger');
  });

  it('should store resolutionPath property', () => {
    const path = ['App', 'UserModule'];
    const error = new TokenNotFoundError('Logger', path, []);
    expect(error.resolutionPath).toEqual(path);
  });

  it('should store availableTokens property', () => {
    const tokens = ['Database', 'Config'];
    const error = new TokenNotFoundError('Logger', [], tokens);
    expect(error.availableTokens).toEqual(tokens);
  });

  it('should work with symbol tokens', () => {
    const token = Symbol('Database');
    const error = new TokenNotFoundError(token, [], []);
    expect(error.message).toContain(`Token '${String(token)}' not found`);
    expect(error.token).toBe(String(token));
  });

  it('should work with class tokens', () => {
    class DatabaseService {}
    const error = new TokenNotFoundError(DatabaseService, [], []);
    expect(error.message).toContain(`DatabaseService`);
    expect(error.token).toBe('DatabaseService');
  });

  it('should extend VoxelError', () => {
    const error = new TokenNotFoundError('Logger', [], []);
    expect(error).toBeInstanceOf(VoxelError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TokenNotFoundError');
  });
});

describe('CircularDependencyError', () => {
  it('should create error with token and dependency chain', () => {
    const error = new CircularDependencyError('ServiceA', ['ServiceA', 'ServiceB', 'ServiceA']);
    expect(error.message).toContain("Circular dependency detected in 'ServiceA'");
    expect(error.message).toContain('Dependency chain: ServiceA -> ServiceB -> ServiceA');
  });

  it('should include suggestion in error message', () => {
    const error = new CircularDependencyError('ServiceA', ['ServiceA', 'ServiceB', 'ServiceA']);
    expect(error.message).toContain('Suggestion: Consider refactoring to break the cycle, or use lazy resolution.');
  });

  it('should store token property', () => {
    const error = new CircularDependencyError('ServiceA', ['ServiceA', 'ServiceB', 'ServiceA']);
    expect(error.token).toBe('ServiceA');
  });

  it('should store dependencyChain property', () => {
    const chain = ['ServiceA', 'ServiceB', 'ServiceA'];
    const error = new CircularDependencyError('ServiceA', chain);
    expect(error.dependencyChain).toEqual(['ServiceA', 'ServiceB', 'ServiceA']);
  });

  it('should work with string tokens', () => {
    const error = new CircularDependencyError('MyService', ['MyService', 'OtherService', 'MyService']);
    expect(error.token).toBe('MyService');
    expect(error.dependencyChain).toEqual(['MyService', 'OtherService', 'MyService']);
  });

  it('should work with symbol tokens', () => {
    const tokenA = Symbol('ServiceA');
    const tokenB = Symbol('ServiceB');
    const error = new CircularDependencyError(tokenA, [tokenA, tokenB, tokenA]);
    expect(error.token).toBe(String(tokenA));
    expect(error.dependencyChain).toEqual([String(tokenA), String(tokenB), String(tokenA)]);
  });

  it('should work with class tokens', () => {
    class ServiceA {}
    class ServiceB {}
    const error = new CircularDependencyError(ServiceA, [ServiceA, ServiceB, ServiceA]);
    expect(error.token).toBe('ServiceA');
    expect(error.dependencyChain).toEqual(['ServiceA', 'ServiceB', 'ServiceA']);
  });

  it('should handle mixed token types in dependency chain', () => {
    class ServiceA {}
    const serviceB = 'ServiceB';
    const serviceC = Symbol('ServiceC');
    const error = new CircularDependencyError(ServiceA, [ServiceA, serviceB, serviceC, ServiceA]);
    expect(error.dependencyChain).toEqual(['ServiceA', 'ServiceB', String(serviceC), 'ServiceA']);
  });

  it('should format complete error message correctly', () => {
    const error = new CircularDependencyError('UserService', ['UserService', 'PostService', 'UserService']);

    const expected = `Circular dependency detected in 'UserService'
  Dependency chain: UserService -> PostService -> UserService
  Suggestion: Consider refactoring to break the cycle, or use lazy resolution.`;

    expect(error.message).toBe(expected);
  });

  it('should extend VoxelError', () => {
    const error = new CircularDependencyError('ServiceA', ['ServiceA', 'ServiceB', 'ServiceA']);
    expect(error).toBeInstanceOf(VoxelError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CircularDependencyError');
  });
});

describe('ScopeValidationError', () => {
  it('should create error with parent and scoped tokens', () => {
    const error = new ScopeValidationError('SingletonService', 'RequestService');
    expect(error.message).toContain("Scope validation failed: Singleton 'SingletonService' depends on scoped 'RequestService'");
  });

  it('should include helpful suggestion', () => {
    const error = new ScopeValidationError('SingletonService', 'RequestService');
    expect(error.message).toContain("Consider making 'SingletonService' scoped, or 'RequestService' singleton/transient.");
  });

  it('should explain why the error occurs', () => {
    const error = new ScopeValidationError('SingletonService', 'RequestService');
    expect(error.message).toContain('Singletons cannot depend on request-scoped providers');
  });

  it('should store parentToken property', () => {
    const error = new ScopeValidationError('Parent', 'Child');
    expect(error.parentToken).toBe('Parent');
  });

  it('should store scopedToken property', () => {
    const error = new ScopeValidationError('Parent', 'Child');
    expect(error.scopedToken).toBe('Child');
  });

  it('should work with class tokens', () => {
    class SingletonService {}
    class RequestService {}
    const error = new ScopeValidationError(SingletonService, RequestService);
    expect(error.parentToken).toBe('SingletonService');
    expect(error.scopedToken).toBe('RequestService');
  });

  it('should work with symbol tokens', () => {
    const parent = Symbol('Singleton');
    const scoped = Symbol('Request');
    const error = new ScopeValidationError(parent, scoped);
    expect(error.parentToken).toBe(String(parent));
    expect(error.scopedToken).toBe(String(scoped));
  });

  it('should extend VoxelError', () => {
    const error = new ScopeValidationError('Parent', 'Child');
    expect(error).toBeInstanceOf(VoxelError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ScopeValidationError');
  });
});

describe('TokenCollisionError', () => {
  it('should create error with token and sources', () => {
    class ConsoleLogger {}
    class FileLogger {}
    const error = new TokenCollisionError('Logger', ConsoleLogger, FileLogger);
    expect(error.message).toContain("Token 'Logger' is already registered");
  });

  it('should include original source in message', () => {
    class ConsoleLogger {}
    class FileLogger {}
    const error = new TokenCollisionError('Logger', ConsoleLogger, FileLogger);
    expect(error.message).toContain('Original: ConsoleLogger');
  });

  it('should include duplicate source in message', () => {
    class ConsoleLogger {}
    class FileLogger {}
    const error = new TokenCollisionError('Logger', ConsoleLogger, FileLogger);
    expect(error.message).toContain('Duplicate: FileLogger');
  });

  it('should include suggestion', () => {
    const error = new TokenCollisionError('Logger', 'Original', 'Duplicate');
    expect(error.message).toContain('Suggestion: Each token should only be registered once.');
  });

  it('should store token property', () => {
    const error = new TokenCollisionError('Logger', 'Original', 'Duplicate');
    expect(error.token).toBe('Logger');
  });

  it('should store originalSource property', () => {
    class Original {}
    const error = new TokenCollisionError('Token', Original, 'Duplicate');
    expect(error.originalSource).toBe('Original');
  });

  it('should store duplicateSource property', () => {
    class Duplicate {}
    const error = new TokenCollisionError('Token', 'Original', Duplicate);
    expect(error.duplicateSource).toBe('Duplicate');
  });

  it('should work with class tokens', () => {
    class Logger {}
    class ConsoleLogger {}
    class FileLogger {}
    const error = new TokenCollisionError(Logger, ConsoleLogger, FileLogger);
    expect(error.token).toBe('Logger');
    expect(error.originalSource).toBe('ConsoleLogger');
    expect(error.duplicateSource).toBe('FileLogger');
  });

  it('should work with string tokens', () => {
    const error = new TokenCollisionError('Database', 'PgDatabase', 'MongoDatabase');
    expect(error.token).toBe('Database');
    expect(error.originalSource).toBe('PgDatabase');
    expect(error.duplicateSource).toBe('MongoDatabase');
  });

  it('should work with symbol tokens', () => {
    const token = Symbol('Logger');
    const original = Symbol('Console');
    const duplicate = Symbol('File');
    const error = new TokenCollisionError(token, original, duplicate);
    expect(error.token).toBe(String(token));
    expect(error.originalSource).toBe(String(original));
    expect(error.duplicateSource).toBe(String(duplicate));
  });

  it('should format complete error message correctly', () => {
    const error = new TokenCollisionError('Logger', 'ConsoleLogger', 'FileLogger');

    const expected = `Token 'Logger' is already registered
  Original: ConsoleLogger
  Duplicate: FileLogger
  Suggestion: Each token should only be registered once. Use a different token or remove the duplicate registration.`;

    expect(error.message).toBe(expected);
  });

  it('should extend VoxelError', () => {
    const error = new TokenCollisionError('Token', 'Original', 'Duplicate');
    expect(error).toBeInstanceOf(VoxelError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TokenCollisionError');
  });
});

describe('NonExportedTokenError', () => {
  it('should create error with token and module info', () => {
    const error = new NonExportedTokenError('PrivateService', 'ConsumerModule', 'ProviderModule', []);
    expect(error.message).toContain('Token "PrivateService" is not exported from module "ProviderModule"');
  });

  it('should include requesting module in message', () => {
    const error = new NonExportedTokenError('Token', 'ConsumerModule', 'ProviderModule', []);
    expect(error.message).toContain('Module "ConsumerModule" can only access exported tokens');
  });

  it('should show exported tokens when available', () => {
    const error = new NonExportedTokenError('PrivateToken', 'Consumer', 'Provider', ['PublicToken', 'SharedToken']);
    expect(error.message).toContain('[PublicToken, SharedToken]');
  });

  it('should show none when no exported tokens', () => {
    const error = new NonExportedTokenError('Token', 'Consumer', 'Provider', []);
    expect(error.message).toContain('[none]');
  });

  it('should include suggestion', () => {
    const error = new NonExportedTokenError('Token', 'Consumer', 'Provider', []);
    expect(error.message).toContain('Either export "Token" from "Provider"');
  });

  it('should store token property', () => {
    const token = 'ServiceToken';
    const error = new NonExportedTokenError(token, 'Consumer', 'Provider', []);
    expect(error.token).toBe(token);
  });

  it('should store requestingModule property', () => {
    const error = new NonExportedTokenError('Token', 'ConsumerModule', 'ProviderModule', []);
    expect(error.requestingModule).toBe('ConsumerModule');
  });

  it('should store ownerModule property', () => {
    const error = new NonExportedTokenError('Token', 'ConsumerModule', 'ProviderModule', []);
    expect(error.ownerModule).toBe('ProviderModule');
  });

  it('should store exportedTokens property', () => {
    const exported = ['Token1', 'Token2'];
    const error = new NonExportedTokenError('Token', 'Consumer', 'Provider', exported);
    expect(error.exportedTokens).toEqual(exported);
  });

  it('should work with class tokens', () => {
    class PrivateService {}
    const error = new NonExportedTokenError(PrivateService, 'Consumer', 'Provider', []);
    expect(error.token).toBe(PrivateService);
    expect(error.message).toContain('PrivateService');
  });

  it('should format exported tokens with both class and string tokens (line 20 branch)', () => {
    // This tests line 20 branch: both function and non-function tokens in exportedTokens
    class PublicService {}
    class AnotherService {}
    const error = new NonExportedTokenError('PrivateToken', 'Consumer', 'Provider', [
      PublicService,
      AnotherService,
      'StringToken',
    ]);
    expect(error.message).toContain('PublicService');
    expect(error.message).toContain('AnotherService');
    expect(error.message).toContain('StringToken');
    expect(error.exportedTokens).toEqual([PublicService, AnotherService, 'StringToken']);
  });

  it('should format exported tokens with symbol tokens (line 20 branch)', () => {
    const publicSymbol = Symbol('PublicService');
    const exportedSymbol = Symbol('Exported');
    const error = new NonExportedTokenError('PrivateToken', 'Consumer', 'Provider', [
      publicSymbol,
      exportedSymbol,
    ]);
    expect(error.message).toContain(String(publicSymbol));
    expect(error.message).toContain(String(exportedSymbol));
  });

  it('should work with symbol tokens', () => {
    const token = Symbol('Private');
    const error = new NonExportedTokenError(token, 'Consumer', 'Provider', []);
    expect(error.token).toBe(token);
    expect(error.message).toContain(String(token));
  });

  it('should have correct error name', () => {
    const error = new NonExportedTokenError('Token', 'Consumer', 'Provider', []);
    expect(error.name).toBe('NonExportedTokenError');
  });

  it('should extend Error', () => {
    const error = new NonExportedTokenError('Token', 'Consumer', 'Provider', []);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('VoxelError captureStackTrace', () => {
  it('should have stack trace property', () => {
    class TestError extends VoxelError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });

  it('should include error message in stack trace', () => {
    class TestError extends VoxelError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error.stack).toContain('test message');
  });

  it('should include error name in stack trace', () => {
    class TestError extends VoxelError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error.stack).toContain('TestError');
  });
});
