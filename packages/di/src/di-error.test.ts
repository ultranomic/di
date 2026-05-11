import { describe, expect, it } from 'vite-plus/test';
import { DIError, DI_ERROR_CODE } from './di-error.ts';

describe('DIError', () => {
  it('sets code property', () => {
    const error = new DIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY, 'cycle detected');
    expect(error.code).toBe(DI_ERROR_CODE.CIRCULAR_DEPENDENCY);
  });

  it('sets message property', () => {
    const error = new DIError(DI_ERROR_CODE.MISSING_PROVIDER, 'no provider for Foo');
    expect(error.message).toBe('no provider for Foo');
  });

  it('sets name to DIError', () => {
    const error = new DIError(DI_ERROR_CODE.DUPLICATE_PROVIDER, 'dup');
    expect(error.name).toBe('DIError');
  });

  it('is instanceof Error', () => {
    const error = new DIError(DI_ERROR_CODE.SCOPE_VIOLATION, 'bad scope');
    expect(error).toBeInstanceOf(Error);
  });

  it('is instanceof DIError', () => {
    const error = new DIError(DI_ERROR_CODE.NOT_IN_REQUEST_SCOPE, 'no request');
    expect(error).toBeInstanceOf(DIError);
  });

  it('supports all error codes', () => {
    const codes = Object.values(DI_ERROR_CODE);
    for (const code of codes) {
      const error = new DIError(code, `msg: ${code}`);
      expect(error.code).toBe(code);
    }
  });

  it('code property is immutable at runtime (backed by private field)', () => {
    const error = new DIError(DI_ERROR_CODE.CONTAINER_STOPPED, 'stopped');
    try {
      // @ts-expect-error — code is readonly
      error.code = DI_ERROR_CODE.CIRCULAR_DEPENDENCY;
    } catch {
      // Strict mode throws TypeError for setter-less properties
    }
    expect(error.code).toBe(DI_ERROR_CODE.CONTAINER_STOPPED);
  });

  it('D5: supports cause option for error chaining', () => {
    const original = new Error('db connection failed');
    const error = new DIError(DI_ERROR_CODE.MISSING_PROVIDER, 'service not found', {
      cause: original,
    });
    expect(error.cause).toBe(original);
  });
});
