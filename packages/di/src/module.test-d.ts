import { assertType, describe, test } from 'vite-plus/test';
import { Injectable } from './injectable.ts';
import { Module } from './module.ts';
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
  scope: SCOPE.TRANSIENT,
}) {}

class SharedModule extends Module({
  providers: [ConfigService],
  exports: [ConfigService],
}) {}

class FeatureModule extends Module({
  providers: [DatabaseService, CacheService],
  exports: [DatabaseService],
  imports: [SharedModule],
}) {}

class EmptyModule extends Module({}) {}

describe('Module types', () => {
  test('_providers is correct type', () => {
    assertType<readonly [typeof ConfigService]>(SharedModule._providers);
    assertType<readonly [typeof DatabaseService, typeof CacheService]>(FeatureModule._providers);
    assertType<readonly []>(EmptyModule._providers);
  });

  test('_exports is correct type', () => {
    assertType<readonly [typeof ConfigService]>(SharedModule._exports);
    assertType<readonly [typeof DatabaseService]>(FeatureModule._exports);
    assertType<readonly []>(EmptyModule._exports);
  });

  test('_imports is correct type', () => {
    assertType<readonly []>(SharedModule._imports);
    assertType<readonly [typeof SharedModule]>(FeatureModule._imports);
    assertType<readonly []>(EmptyModule._imports);
  });

  test('module with all optional config', () => {
    const AllOptionalModule = Module({});
    assertType<readonly []>(AllOptionalModule._providers);
    assertType<readonly []>(AllOptionalModule._exports);
    assertType<readonly []>(AllOptionalModule._imports);
  });

  test('module with only providers', () => {
    const ProvidersOnlyModule = Module({
      providers: [ConfigService],
    });
    assertType<readonly [typeof ConfigService]>(ProvidersOnlyModule._providers);
    assertType<readonly []>(ProvidersOnlyModule._exports);
    assertType<readonly []>(ProvidersOnlyModule._imports);
  });

  test('module with providers and exports', () => {
    const ProvidersExportsModule = Module({
      providers: [ConfigService, DatabaseService],
      exports: [ConfigService],
    });
    assertType<readonly [typeof ConfigService, typeof DatabaseService]>(
      ProvidersExportsModule._providers,
    );
    assertType<readonly [typeof ConfigService]>(ProvidersExportsModule._exports);
    assertType<readonly []>(ProvidersExportsModule._imports);
  });

  test('module with ModuleClass in exports preserves ModuleClass entries', () => {
    class LoggerService extends Injectable() {}

    class SubModule extends Module({
      providers: [LoggerService],
      exports: [LoggerService],
    }) {}

    class ParentModule extends Module({
      providers: [ConfigService],
      imports: [SubModule],
      exports: [SubModule, ConfigService],
    }) {}

    assertType<readonly [typeof SubModule, typeof ConfigService]>(ParentModule._exports);
    assertType<readonly [typeof ConfigService]>(ParentModule._providers);
  });

  test('_isModule is true on Module classes', () => {
    assertType<true>(SharedModule._isModule);
    assertType<true>(FeatureModule._isModule);
  });

  test('_isInjectable is true on Injectable classes', () => {
    assertType<true>(ConfigService._isInjectable);
    assertType<true>(DatabaseService._isInjectable);
  });

  test('export constraint: cannot export InjectableClass not in providers', () => {
    class OrphanService extends Injectable() {}

    class SubModule extends Module({
      providers: [ConfigService],
      exports: [ConfigService],
    }) {}

    class _BadModule extends Module({
      providers: [DatabaseService],
      imports: [SubModule],
      // @ts-expect-error — OrphanService is not in providers or imports
      exports: [OrphanService],
    }) {}
  });

  test('export constraint: cannot export ModuleClass not in imports', () => {
    class _SubModule extends Module({
      providers: [ConfigService],
      exports: [ConfigService],
    }) {}

    class _UnrelatedModule extends Module({
      providers: [DatabaseService],
      exports: [DatabaseService],
    }) {}

    class _BadModule extends Module({
      providers: [DatabaseService],
      // @ts-expect-error — UnrelatedModule is not in imports
      exports: [_UnrelatedModule],
    }) {}
  });

  test('export constraint: can export InjectableClass from providers', () => {
    class GoodModule extends Module({
      providers: [ConfigService, DatabaseService],
      exports: [ConfigService, DatabaseService],
    }) {}

    assertType<readonly [typeof ConfigService, typeof DatabaseService]>(GoodModule._exports);
  });

  test('export constraint: can export ModuleClass from imports', () => {
    class SubModule extends Module({
      providers: [ConfigService],
      exports: [ConfigService],
    }) {}

    class GoodModule extends Module({
      providers: [DatabaseService],
      imports: [SubModule],
      exports: [SubModule, DatabaseService],
    }) {}

    assertType<readonly [typeof SubModule, typeof DatabaseService]>(GoodModule._exports);
  });
});
