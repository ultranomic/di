import { describe, expect, it } from 'vitest';
import {
  CircularDependencyError,
  ScopeValidationError,
  TokenCollisionError,
  TokenNotFoundError,
  DIError,
} from '../index.ts';
import { NonExportedTokenError } from './non-exported-token.ts';

describe('DIError', () => {
  it('should set error name to class name', () => {
    class TestError extends DIError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error.name).toBe('TestError');
  });

  it('should call captureStackTrace when available (line 14 branch)', () => {
    class TestError extends DIError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    // In Node.js, captureStackTrace should be available
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('TestError');
  });

  it('should extend Error', () => {
    class TestError extends DIError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DIError);
  });

  it('should have message property', () => {
    class TestError extends DIError {
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
    class Logger {}
    const error = new TokenNotFoundError(Logger, [], []);
    expect(error.message).toContain("Token 'Logger' not found");
  });

  it('should include resolution path when provided', () => {
    class Logger {}
    class App {}
    class UserModule {}
    class UserService {}
    const error = new TokenNotFoundError(Logger, [App, UserModule, UserService], []);
    expect(error.message).toContain('Resolution path: App -> UserModule -> UserService -> Logger');
  });

  it('should not include resolution path when empty', () => {
    class Logger {}
    const error = new TokenNotFoundError(Logger, [], []);
    expect(error.message).not.toContain('Resolution path:');
  });

  it('should include available tokens when provided', () => {
    class Logger {}
    class Database {}
    class Config {}
    class Cache {}
    const error = new TokenNotFoundError(Logger, [], [Database, Config, Cache]);
    expect(error.message).toContain('Available tokens: Database, Config, Cache');
  });

  it('should show none registered when no available tokens', () => {
    class Logger {}
    const error = new TokenNotFoundError(Logger, [], []);
    expect(error.message).toContain('Available tokens: (none registered)');
  });

  it('should include helpful suggestion', () => {
    class Logger {}
    const error = new TokenNotFoundError(Logger, [], []);
    expect(error.message).toContain("Suggestion: Did you mean to import a module that provides 'Logger'?");
  });

  it('should format complete error message correctly', () => {
    class Logger {}
    class App {}
    class UserService {}
    class Database {}
    class Config {}
    const error = new TokenNotFoundError(Logger, [App, UserService], [Database, Config]);

    const expected = `Token 'Logger' not found
  Resolution path: App -> UserService -> Logger
  Available tokens: Database, Config
  Suggestion: Did you mean to import a module that provides 'Logger'?`;

    expect(error.message).toBe(expected);
  });

  it('should store token property', () => {
    class Logger {}
    const error = new TokenNotFoundError(Logger, [], []);
    expect(error.token).toBe('Logger');
  });

  it('should store resolutionPath property', () => {
    class Logger {}
    class App {}
    class UserModule {}
    const path = [App, UserModule];
    const error = new TokenNotFoundError(Logger, path, []);
    expect(error.resolutionPath).toEqual(['App', 'UserModule']);
  });

  it('should store availableTokens property', () => {
    class Logger {}
    class Database {}
    class Config {}
    const tokens = [Database, Config];
    const error = new TokenNotFoundError(Logger, [], tokens);
    expect(error.availableTokens).toEqual(['Database', 'Config']);
  });

  it('should work with class tokens', () => {
    class DatabaseService {}
    const error = new TokenNotFoundError(DatabaseService, [], []);
    expect(error.message).toContain(`DatabaseService`);
    expect(error.token).toBe('DatabaseService');
  });

  it('should work with string tokens (lines 44-46 branch)', () => {
    const error = new TokenNotFoundError('Logger', [], []);
    expect(error.token).toBe('Logger');
    expect(error.message).toContain("Token 'Logger' not found");
  });

  it('should work with symbol tokens (lines 44-46 branch)', () => {
    const logger = Symbol('Logger');
    const error = new TokenNotFoundError(logger, [], []);
    expect(error.token).toBe('Symbol(Logger)');
  });

  it('should work with mixed function and string tokens in resolution path (lines 44-46 branch)', () => {
    class App {}
    const error = new TokenNotFoundError('Logger', [App, 'UserService', 'AuthService'], []);
    expect(error.token).toBe('Logger');
    expect(error.resolutionPath).toEqual(['App', 'UserService', 'AuthService']);
  });

  it('should work with mixed function and string tokens in available tokens (lines 44-46 branch)', () => {
    class Database {}
    const error = new TokenNotFoundError('Logger', [], [Database, 'Config', 'Cache']);
    expect(error.token).toBe('Logger');
    expect(error.availableTokens).toEqual(['Database', 'Config', 'Cache']);
  });

  it('should extend DIError', () => {
    class Logger {}
    const error = new TokenNotFoundError(Logger, [], []);
    expect(error).toBeInstanceOf(DIError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TokenNotFoundError');
  });
});

describe('CircularDependencyError', () => {
  it('should create error with token and dependency chain', () => {
    class ServiceA {}
    class ServiceB {}
    const error = new CircularDependencyError(ServiceA, [ServiceA, ServiceB, ServiceA]);
    expect(error.message).toContain("Circular dependency detected in 'ServiceA'");
    expect(error.message).toContain('Dependency chain: ServiceA -> ServiceB -> ServiceA');
  });

  it('should include suggestion in error message', () => {
    class ServiceA {}
    class ServiceB {}
    const error = new CircularDependencyError(ServiceA, [ServiceA, ServiceB, ServiceA]);
    expect(error.message).toContain('Suggestion: Consider refactoring to break the cycle, or use lazy resolution.');
  });

  it('should store token property', () => {
    class ServiceA {}
    class ServiceB {}
    const error = new CircularDependencyError(ServiceA, [ServiceA, ServiceB, ServiceA]);
    expect(error.token).toBe('ServiceA');
  });

  it('should store dependencyChain property', () => {
    class ServiceA {}
    class ServiceB {}
    const chain = [ServiceA, ServiceB, ServiceA];
    const error = new CircularDependencyError(ServiceA, chain);
    expect(error.dependencyChain).toEqual(['ServiceA', 'ServiceB', 'ServiceA']);
  });

  it('should work with class tokens', () => {
    class ServiceA {}
    class ServiceB {}
    const error = new CircularDependencyError(ServiceA, [ServiceA, ServiceB, ServiceA]);
    expect(error.token).toBe('ServiceA');
    expect(error.dependencyChain).toEqual(['ServiceA', 'ServiceB', 'ServiceA']);
  });

  it('should format complete error message correctly', () => {
    class UserService {}
    class PostService {}
    const error = new CircularDependencyError(UserService, [UserService, PostService, UserService]);

    const expected = `Circular dependency detected in 'UserService'
  Dependency chain: UserService -> PostService -> UserService
  Suggestion: Consider refactoring to break the cycle, or use lazy resolution.`;

    expect(error.message).toBe(expected);
  });

  it('should work with string tokens (lines 34-35 branch)', () => {
    const error = new CircularDependencyError('ServiceA', ['ServiceA', 'ServiceB', 'ServiceA']);
    expect(error.token).toBe('ServiceA');
    expect(error.dependencyChain).toEqual(['ServiceA', 'ServiceB', 'ServiceA']);
    expect(error.message).toContain("Circular dependency detected in 'ServiceA'");
  });

  it('should work with symbol tokens (lines 34-35 branch)', () => {
    const tokenA = Symbol('ServiceA');
    const tokenB = Symbol('ServiceB');
    const error = new CircularDependencyError(tokenA, [tokenA, tokenB, tokenA]);
    expect(error.token).toBe('Symbol(ServiceA)');
    expect(error.dependencyChain).toEqual(['Symbol(ServiceA)', 'Symbol(ServiceB)', 'Symbol(ServiceA)']);
  });

  it('should work with mixed function and string tokens (lines 34-35 branch)', () => {
    class ServiceA {}
    const error = new CircularDependencyError(ServiceA, [ServiceA, 'ServiceB', ServiceA]);
    expect(error.token).toBe('ServiceA');
    expect(error.dependencyChain).toEqual(['ServiceA', 'ServiceB', 'ServiceA']);
  });

  it('should extend DIError', () => {
    class ServiceA {}
    class ServiceB {}
    const error = new CircularDependencyError(ServiceA, [ServiceA, ServiceB, ServiceA]);
    expect(error).toBeInstanceOf(DIError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CircularDependencyError');
  });
});

describe('ScopeValidationError', () => {
  it('should create error with parent and scoped tokens', () => {
    class SingletonService {}
    class RequestService {}
    const error = new ScopeValidationError(SingletonService, RequestService);
    expect(error.message).toContain(
      "Scope validation failed: Singleton 'SingletonService' depends on scoped 'RequestService'",
    );
  });

  it('should include helpful suggestion', () => {
    class SingletonService {}
    class RequestService {}
    const error = new ScopeValidationError(SingletonService, RequestService);
    expect(error.message).toContain(
      "Consider making 'SingletonService' scoped, or 'RequestService' singleton/transient.",
    );
  });

  it('should explain why the error occurs', () => {
    class SingletonService {}
    class RequestService {}
    const error = new ScopeValidationError(SingletonService, RequestService);
    expect(error.message).toContain('Singletons cannot depend on request-scoped providers');
  });

  it('should store parentToken property', () => {
    class Parent {}
    class Child {}
    const error = new ScopeValidationError(Parent, Child);
    expect(error.parentToken).toBe('Parent');
  });

  it('should store scopedToken property', () => {
    class Parent {}
    class Child {}
    const error = new ScopeValidationError(Parent, Child);
    expect(error.scopedToken).toBe('Child');
  });

  it('should work with class tokens', () => {
    class SingletonService {}
    class RequestService {}
    const error = new ScopeValidationError(SingletonService, RequestService);
    expect(error.parentToken).toBe('SingletonService');
    expect(error.scopedToken).toBe('RequestService');
  });

  it('should work with string tokens (lines 9-10 branch)', () => {
    const error = new ScopeValidationError('SingletonService', 'RequestService');
    expect(error.parentToken).toBe('SingletonService');
    expect(error.scopedToken).toBe('RequestService');
    expect(error.message).toContain("Singleton 'SingletonService' depends on scoped 'RequestService'");
  });

  it('should work with symbol tokens (lines 9-10 branch)', () => {
    const parent = Symbol('SingletonService');
    const scoped = Symbol('RequestService');
    const error = new ScopeValidationError(parent, scoped);
    expect(error.parentToken).toBe('Symbol(SingletonService)');
    expect(error.scopedToken).toBe('Symbol(RequestService)');
  });

  it('should work with mixed function and string tokens (lines 9-10 branch)', () => {
    class SingletonService {}
    const error = new ScopeValidationError(SingletonService, 'RequestService');
    expect(error.parentToken).toBe('SingletonService');
    expect(error.scopedToken).toBe('RequestService');
  });

  it('should extend DIError', () => {
    class Parent {}
    class Child {}
    const error = new ScopeValidationError(Parent, Child);
    expect(error).toBeInstanceOf(DIError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ScopeValidationError');
  });
});

describe('TokenCollisionError', () => {
  it('should create error with token and sources', () => {
    class Logger {}
    class ConsoleLogger {}
    class FileLogger {}
    const error = new TokenCollisionError(Logger, ConsoleLogger, FileLogger);
    expect(error.message).toContain("Token 'Logger' is already registered");
  });

  it('should include original source in message', () => {
    class Logger {}
    class ConsoleLogger {}
    class FileLogger {}
    const error = new TokenCollisionError(Logger, ConsoleLogger, FileLogger);
    expect(error.message).toContain('Original: ConsoleLogger');
  });

  it('should include duplicate source in message', () => {
    class Logger {}
    class ConsoleLogger {}
    class FileLogger {}
    const error = new TokenCollisionError(Logger, ConsoleLogger, FileLogger);
    expect(error.message).toContain('Duplicate: FileLogger');
  });

  it('should include suggestion', () => {
    class Logger {}
    class Original {}
    class Duplicate {}
    const error = new TokenCollisionError(Logger, Original, Duplicate);
    expect(error.message).toContain('Suggestion: Each token should only be registered once.');
  });

  it('should store token property', () => {
    class Logger {}
    class Original {}
    class Duplicate {}
    const error = new TokenCollisionError(Logger, Original, Duplicate);
    expect(error.token).toBe('Logger');
  });

  it('should store originalSource property', () => {
    class Token {}
    class Original {}
    const error = new TokenCollisionError(Token, Original, 'Duplicate');
    expect(error.originalSource).toBe('Original');
  });

  it('should store duplicateSource property', () => {
    class Token {}
    class Duplicate {}
    const error = new TokenCollisionError(Token, 'Original', Duplicate);
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

  it('should work with string tokens (line 41 branch)', () => {
    const error = new TokenCollisionError('Logger', 'ConsoleLogger', 'FileLogger');
    expect(error.token).toBe('Logger');
    expect(error.originalSource).toBe('ConsoleLogger');
    expect(error.duplicateSource).toBe('FileLogger');
    expect(error.message).toContain("Token 'Logger' is already registered");
  });

  it('should work with symbol tokens (line 41 branch)', () => {
    const logger = Symbol('Logger');
    const consoleLogger = Symbol('ConsoleLogger');
    const fileLogger = Symbol('FileLogger');
    const error = new TokenCollisionError(logger, consoleLogger, fileLogger);
    expect(error.token).toBe('Symbol(Logger)');
    expect(error.originalSource).toBe('Symbol(ConsoleLogger)');
    expect(error.duplicateSource).toBe('Symbol(FileLogger)');
  });

  it('should work with mixed function and string tokens (line 41 branch)', () => {
    class Logger {}
    const error = new TokenCollisionError(Logger, 'ConsoleLogger', 'FileLogger');
    expect(error.token).toBe('Logger');
    expect(error.originalSource).toBe('ConsoleLogger');
    expect(error.duplicateSource).toBe('FileLogger');
  });

  it('should format complete error message correctly', () => {
    class Logger {}
    class ConsoleLogger {}
    class FileLogger {}
    const error = new TokenCollisionError(Logger, ConsoleLogger, FileLogger);

    const expected = `Token 'Logger' is already registered
  Original: ConsoleLogger
  Duplicate: FileLogger
  Suggestion: Each token should only be registered once. Use a different token or remove the duplicate registration.`;

    expect(error.message).toBe(expected);
  });

  it('should extend DIError', () => {
    class Token {}
    class Original {}
    class Duplicate {}
    const error = new TokenCollisionError(Token, Original, Duplicate);
    expect(error).toBeInstanceOf(DIError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TokenCollisionError');
  });
});

describe('NonExportedTokenError', () => {
  it('should create error with token and module info', () => {
    class PrivateService {}
    const error = new NonExportedTokenError(PrivateService, 'ConsumerModule', 'ProviderModule', []);
    expect(error.message).toContain('Token "PrivateService" is not exported from module "ProviderModule"');
  });

  it('should include requesting module in message', () => {
    class Token {}
    const error = new NonExportedTokenError(Token, 'ConsumerModule', 'ProviderModule', []);
    expect(error.message).toContain('Module "ConsumerModule" can only access exported tokens');
  });

  it('should show exported tokens when available', () => {
    class PrivateToken {}
    class PublicToken {}
    class SharedToken {}
    const error = new NonExportedTokenError(PrivateToken, 'Consumer', 'Provider', [PublicToken, SharedToken]);
    expect(error.message).toContain('[PublicToken, SharedToken]');
  });

  it('should show none when no exported tokens', () => {
    class Token {}
    const error = new NonExportedTokenError(Token, 'Consumer', 'Provider', []);
    expect(error.message).toContain('[none]');
  });

  it('should include suggestion', () => {
    class Token {}
    const error = new NonExportedTokenError(Token, 'Consumer', 'Provider', []);
    expect(error.message).toContain('Either export "Token" from "Provider"');
  });

  it('should store token property', () => {
    class ServiceToken {}
    const error = new NonExportedTokenError(ServiceToken, 'Consumer', 'Provider', []);
    expect(error.token).toBe(ServiceToken);
  });

  it('should store requestingModule property', () => {
    class Token {}
    const error = new NonExportedTokenError(Token, 'ConsumerModule', 'ProviderModule', []);
    expect(error.requestingModule).toBe('ConsumerModule');
  });

  it('should store ownerModule property', () => {
    class Token {}
    const error = new NonExportedTokenError(Token, 'ConsumerModule', 'ProviderModule', []);
    expect(error.ownerModule).toBe('ProviderModule');
  });

  it('should store exportedTokens property', () => {
    class Token {}
    class Token1 {}
    class Token2 {}
    const exported = [Token1, Token2];
    const error = new NonExportedTokenError(Token, 'Consumer', 'Provider', exported);
    expect(error.exportedTokens).toEqual(exported);
  });

  it('should work with class tokens', () => {
    class PrivateService {}
    const error = new NonExportedTokenError(PrivateService, 'Consumer', 'Provider', []);
    expect(error.token).toBe(PrivateService);
    expect(error.message).toContain('PrivateService');
  });

  it('should format exported tokens with class tokens (line 20 branch)', () => {
    // This tests line 20 branch: all function tokens in exportedTokens
    class PrivateToken {}
    class PublicService {}
    class AnotherService {}
    class ThirdService {}
    const error = new NonExportedTokenError(PrivateToken, 'Consumer', 'Provider', [
      PublicService,
      AnotherService,
      ThirdService,
    ]);
    expect(error.message).toContain('PublicService');
    expect(error.message).toContain('AnotherService');
    expect(error.message).toContain('ThirdService');
    expect(error.exportedTokens).toEqual([PublicService, AnotherService, ThirdService]);
  });

  it('should work with string tokens (lines 19-22 branch)', () => {
    const error = new NonExportedTokenError('PrivateToken', 'ConsumerModule', 'ProviderModule', [
      'PublicService',
      'AnotherService',
    ]);
    expect(error.message).toContain('PrivateToken');
    expect(error.requestingModule).toBe('ConsumerModule');
    expect(error.ownerModule).toBe('ProviderModule');
    expect(error.exportedTokens).toEqual(['PublicService', 'AnotherService']);
    // Verify string tokens (not functions) are being used
    expect(error.message).toContain('ConsumerModule');
    expect(error.message).toContain('ProviderModule');
    expect(error.message).toContain('PublicService');
    expect(error.message).toContain('AnotherService');
  });

  it('should work with symbol tokens (lines 19-22 branch)', () => {
    const privateToken = Symbol('PrivateToken');
    const requesting = Symbol('ConsumerModule');
    const owner = Symbol('ProviderModule');
    const exported = [Symbol('PublicService'), Symbol('AnotherService')];
    const error = new NonExportedTokenError(privateToken, requesting, owner, exported);
    expect(error.message).toContain('Symbol(PrivateToken)');
    expect(error.requestingModule).toBe('Symbol(ConsumerModule)');
    expect(error.ownerModule).toBe('Symbol(ProviderModule)');
  });

  it('should work with mixed function and string tokens (lines 19-22 branch)', () => {
    class PrivateToken {}
    const error = new NonExportedTokenError(PrivateToken, 'ConsumerModule', 'ProviderModule', [
      'PublicService',
      'AnotherService',
    ]);
    expect(error.message).toContain('PrivateToken');
    expect(error.requestingModule).toBe('ConsumerModule');
    expect(error.ownerModule).toBe('ProviderModule');
  });

  it('should work with function requestingModule and string ownerModule (lines 19-22 branch)', () => {
    class PrivateToken {}
    class ConsumerModule {}
    const error = new NonExportedTokenError(PrivateToken, ConsumerModule, 'ProviderModule', []);
    expect(error.requestingModule).toBe('ConsumerModule');
    expect(error.ownerModule).toBe('ProviderModule');
  });

  it('should work with function ownerModule (line 21 then branch)', () => {
    class PrivateToken {}
    class ProviderModule {}
    const error = new NonExportedTokenError(PrivateToken, 'ConsumerModule', ProviderModule, []);
    expect(error.ownerModule).toBe('ProviderModule');
    expect(error.message).toContain('ProviderModule');
  });

  it('should work with all function parameters (lines 19-22 then branches)', () => {
    class PrivateToken {}
    class ConsumerModule {}
    class ProviderModule {}
    class PublicService {}
    const error = new NonExportedTokenError(PrivateToken, ConsumerModule, ProviderModule, [PublicService]);
    expect(error.token).toBe(PrivateToken);
    expect(error.requestingModule).toBe('ConsumerModule');
    expect(error.ownerModule).toBe('ProviderModule');
    expect(error.message).toContain('PrivateToken');
    expect(error.message).toContain('ConsumerModule');
    expect(error.message).toContain('ProviderModule');
    expect(error.message).toContain('PublicService');
  });

  it('should have correct error name', () => {
    class Token {}
    const error = new NonExportedTokenError(Token, 'Consumer', 'Provider', []);
    expect(error.name).toBe('NonExportedTokenError');
  });

  it('should extend DIError', () => {
    class Token {}
    const error = new NonExportedTokenError(Token, 'Consumer', 'Provider', []);
    expect(error).toBeInstanceOf(DIError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('DIError captureStackTrace', () => {
  it('should have stack trace property', () => {
    class TestError extends DIError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });

  it('should include error message in stack trace', () => {
    class TestError extends DIError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error.stack).toContain('test message');
  });

  it('should include error name in stack trace', () => {
    class TestError extends DIError {
      constructor() {
        super('test message');
      }
    }

    const error = new TestError();
    expect(error.stack).toContain('TestError');
  });
});
