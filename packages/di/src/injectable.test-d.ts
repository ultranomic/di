import { assertType, describe, expectTypeOf, test } from 'vite-plus/test';
import { Injectable } from './injectable.ts';
import { SCOPE } from './scope.ts';

class ConfigService extends Injectable() {
  public getDbUrl(): string {
    return 'postgres://localhost:5432/mydb';
  }
}

class DatabaseService extends Injectable({
  inject: [['config', ConfigService]],
}) {
  public connect(): string {
    return this.inject.config.getDbUrl();
  }
}

class CacheService extends Injectable({
  inject: [
    ['db', DatabaseService],
    ['config', ConfigService],
  ],
}) {
  public get(): string {
    return this.inject.db.connect() + this.inject.config.getDbUrl();
  }
}

class TransientService extends Injectable({
  scope: SCOPE.TRANSIENT,
}) {}

describe('Injectable types', () => {
  test('instance properties work correctly', () => {
    const db = new DatabaseService(new ConfigService());
    expectTypeOf(db.inject.config.getDbUrl()).toBeString();

    const cache = new CacheService(new DatabaseService(new ConfigService()), new ConfigService());
    expectTypeOf(cache.inject.db.connect()).toBeString();
    expectTypeOf(cache.inject.config.getDbUrl()).toBeString();
  });

  test('static properties are correct', () => {
    expectTypeOf(ConfigService._scope).toEqualTypeOf<'SINGLETON'>();
    expectTypeOf(DatabaseService._scope).toEqualTypeOf<'SINGLETON'>();
    expectTypeOf(TransientService._scope).toEqualTypeOf<'TRANSIENT'>();
  });

  test('inject metadata is correct', () => {
    assertType<readonly []>(ConfigService._inject);
    assertType<readonly [readonly ['config', typeof ConfigService]]>(DatabaseService._inject);
  });

  test('empty inject shape is empty object', () => {
    expectTypeOf(new ConfigService().inject).toEqualTypeOf<{}>();
  });

  test('empty inject shape rejects property access', () => {
    // @ts-expect-error -- no inject properties on no-config Injectable
    void new ConfigService().inject.nonexistent;
  });

  test('rejects empty string as inject key', () => {
    // @ts-expect-error -- empty string is not a valid identifier
    class _BadEmpty extends Injectable({ inject: [['', ConfigService]] }) {}
    void _BadEmpty;
  });

  test('rejects identifier starting with digit', () => {
    // @ts-expect-error -- identifier cannot start with a digit
    class _BadDigit extends Injectable({ inject: [['1bad', ConfigService]] }) {}
    void _BadDigit;
  });

  test('rejects identifier with special characters', () => {
    // @ts-expect-error -- identifier cannot contain special characters
    class _BadChar extends Injectable({ inject: [['bad-name', ConfigService]] }) {}
    void _BadChar;
  });

  test('rejects duplicate inject keys', () => {
    class _BadDup extends Injectable({
      inject: [
        // @ts-expect-error -- duplicate inject key "dup"
        ['dup', ConfigService],
        // @ts-expect-error -- duplicate inject key "dup"
        ['dup', ConfigService],
      ],
    }) {}
    void _BadDup;
  });
});
