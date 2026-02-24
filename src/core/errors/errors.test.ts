import { describe, expect, it } from 'vitest';
import { TokenNotFoundError, VoxelError } from '../index.ts';

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
