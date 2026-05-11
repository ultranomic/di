import { assertType, describe, test } from 'vite-plus/test';
import { DIError, DI_ERROR_CODE, type DIErrorCode } from './di-error.ts';

describe('DIError types', () => {
  test('DI_ERROR_CODE values are string literals', () => {
    assertType<'CIRCULAR_DEPENDENCY'>(DI_ERROR_CODE.CIRCULAR_DEPENDENCY);
    assertType<'MISSING_PROVIDER'>(DI_ERROR_CODE.MISSING_PROVIDER);
    assertType<'DUPLICATE_PROVIDER'>(DI_ERROR_CODE.DUPLICATE_PROVIDER);
    assertType<'EXPORT_NOT_IN_PROVIDERS'>(DI_ERROR_CODE.EXPORT_NOT_IN_PROVIDERS);
    assertType<'SCOPE_VIOLATION'>(DI_ERROR_CODE.SCOPE_VIOLATION);
    assertType<'NOT_IN_REQUEST_SCOPE'>(DI_ERROR_CODE.NOT_IN_REQUEST_SCOPE);
    assertType<'CONTAINER_STOPPED'>(DI_ERROR_CODE.CONTAINER_STOPPED);
    assertType<'CONTAINER_NOT_STARTED'>(DI_ERROR_CODE.CONTAINER_NOT_STARTED);
    assertType<'ALREADY_STARTED'>(DI_ERROR_CODE.ALREADY_STARTED);
    assertType<'UNKNOWN_SCOPE'>(DI_ERROR_CODE.UNKNOWN_SCOPE);
    assertType<'DUPLICATE_INJECT_KEY'>(DI_ERROR_CODE.DUPLICATE_INJECT_KEY);
  });

  test('DIErrorCode is union of all error code literals', () => {
    assertType<DIErrorCode>(DI_ERROR_CODE.CIRCULAR_DEPENDENCY);
    assertType<DIErrorCode>(DI_ERROR_CODE.MISSING_PROVIDER);
    assertType<DIErrorCode>(DI_ERROR_CODE.DUPLICATE_PROVIDER);
    assertType<DIErrorCode>(DI_ERROR_CODE.EXPORT_NOT_IN_PROVIDERS);
    assertType<DIErrorCode>(DI_ERROR_CODE.SCOPE_VIOLATION);
    assertType<DIErrorCode>(DI_ERROR_CODE.NOT_IN_REQUEST_SCOPE);
    assertType<DIErrorCode>(DI_ERROR_CODE.CONTAINER_STOPPED);
    assertType<DIErrorCode>(DI_ERROR_CODE.CONTAINER_NOT_STARTED);
    assertType<DIErrorCode>(DI_ERROR_CODE.ALREADY_STARTED);
    assertType<DIErrorCode>(DI_ERROR_CODE.UNKNOWN_SCOPE);
    assertType<DIErrorCode>(DI_ERROR_CODE.DUPLICATE_INJECT_KEY);
  });

  test('DIError extends Error', () => {
    const error = new DIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY, 'test');
    assertType<Error>(error);
    assertType<DIError>(error);
  });

  test('DIError.code returns DIErrorCode', () => {
    const error = new DIError(DI_ERROR_CODE.MISSING_PROVIDER, 'test');
    assertType<DIErrorCode>(error.code);
  });

  test('DIError has Error properties', () => {
    const error = new DIError(DI_ERROR_CODE.SCOPE_VIOLATION, 'test');
    assertType<string>(error.message);
    assertType<string>(error.name);
    assertType<string | undefined>(error.stack);
  });

  test('DIError constructor accepts ErrorOptions', () => {
    const cause = new Error('cause');
    const error = new DIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY, 'test', { cause });
    assertType<unknown>(error.cause);
  });
});
