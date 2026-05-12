import { assertType, describe, expectTypeOf, test } from 'vite-plus/test';
import { Logger } from './logger.ts';
import { LOG_LEVEL, type LogLevel } from './log-level.ts';
import { SCOPE } from './scope.ts';
import { Injectable } from './injectable.ts';

class DepService extends Injectable() {
  public getValue(): string {
    return 'value';
  }
}

class TypedLogger extends Logger({ name: 'TypedLogger' }) {}

class TypedWarnLogger extends Logger({ name: 'WarnLogger', level: LOG_LEVEL.WARN }) {}

class TypedTransientLogger extends Logger({ name: 'TransientLogger', scope: SCOPE.TRANSIENT }) {}

class TypedDepsLogger extends Logger({
  name: 'DepsLogger',
  inject: [['dep', DepService]],
}) {}

describe('Logger types', () => {
  test('instance name is string', () => {
    expectTypeOf(new TypedLogger().name).toEqualTypeOf<string | undefined>();
  });

  test('instance level is LogLevel', () => {
    expectTypeOf(new TypedLogger().level).toEqualTypeOf<LogLevel>();
    expectTypeOf(new TypedWarnLogger().level).toEqualTypeOf<LogLevel>();
  });

  test('_scope type narrows correctly', () => {
    expectTypeOf(TypedLogger._scope).toEqualTypeOf<'SINGLETON'>();
    expectTypeOf(TypedTransientLogger._scope).toEqualTypeOf<'TRANSIENT'>();
  });

  test('inject shape is correct when deps are provided', () => {
    const logger = new TypedDepsLogger(new DepService());
    expectTypeOf(logger.inject.dep.getValue()).toBeString();
  });

  test('inject shape is empty object when no deps', () => {
    expectTypeOf(new TypedLogger().inject).toEqualTypeOf<{}>();
  });

  test('_isLogger is true literal type', () => {
    expectTypeOf(TypedLogger._isLogger).toEqualTypeOf<true>();
  });

  test('_isInjectable is inherited', () => {
    assertType<true>(TypedLogger._isInjectable);
  });
});
