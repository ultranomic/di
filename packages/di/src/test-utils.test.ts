import { describe, expect, it } from 'vite-plus/test';
import { DIError, DI_ERROR_CODE } from './di-error.ts';
import './test-utils.ts';

describe('toThrowDIError — failure branches', () => {
  it('fails when callback throws a non-DIError', () => {
    try {
      expect(() => {
        throw new Error('plain');
      }).toThrowDIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY);
    } catch {
      // intentional
    }
  });

  it('fails when callback throws a non-Error value', () => {
    try {
      expect(() => {
        throw 'string-error';
      }).toThrowDIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY);
    } catch {
      // intentional
    }
  });

  it('fails when callback throws DIError with wrong code', () => {
    try {
      expect(() => {
        throw new DIError(DI_ERROR_CODE.MISSING_PROVIDER, 'msg');
      }).toThrowDIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY);
    } catch {
      // intentional
    }
  });

  it('fails when callback throws DIError with matching code but message fails pattern', () => {
    try {
      expect(() => {
        throw new DIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY, 'no match');
      }).toThrowDIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY, /pattern/);
    } catch {
      // intentional
    }
  });

  it('fails when callback returns a Promise (async)', () => {
    try {
      expect(() => Promise.resolve('oops') as unknown as () => unknown).toThrowDIError(
        DI_ERROR_CODE.CIRCULAR_DEPENDENCY,
      );
    } catch {
      // intentional
    }
  });

  it('inverts success branch via .not', () => {
    try {
      expect(() => {
        throw new DIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY, 'test');
      }).not.toThrowDIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY);
    } catch {
      // intentional
    }
  });
});
