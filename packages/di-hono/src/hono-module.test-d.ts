import { assertType, describe, test } from 'vite-plus/test';
import { HonoModule } from './hono-module.ts';
import type { HonoModuleClass, HonoModuleOptionsFactory, HonoModuleOptions } from './types.ts';
import { Injectable, Module } from '@ultranomic/di';
import type { InjectableClass, ModuleClass } from '@ultranomic/di';

class UserService extends Injectable() {}

class UserController extends Injectable() {}

class AppModule extends HonoModule({
  providers: [UserService, UserController],
  options: () => ({
    port: 3000,
    host: '0.0.0.0',
  }),
}) {}

class EmptyModule extends HonoModule() {}

class ModuleWithMiddlewares extends HonoModule({
  options: () => ({
    middlewares: [],
    port: 8080,
  }),
}) {}

class PlainModule extends Module({}) {}

class SharedModule extends Module({
  providers: [UserService],
  exports: [UserService],
}) {}

class ReExportModule extends HonoModule({
  imports: [SharedModule],
  exports: [SharedModule],
}) {}

describe('HonoModule types', () => {
  test('_isHonoModule is literal true', () => {
    assertType<true>(AppModule._isHonoModule);
    assertType<true>(EmptyModule._isHonoModule);
    assertType<true>(ModuleWithMiddlewares._isHonoModule);
  });

  test('_honoOptions is HonoModuleOptionsFactory', () => {
    assertType<HonoModuleOptionsFactory>(AppModule._honoOptions);
    assertType<HonoModuleOptionsFactory>(EmptyModule._honoOptions);
    assertType<HonoModuleOptionsFactory>(ModuleWithMiddlewares._honoOptions);
  });

  test('_providers is InjectableClass[] (auto-includes HonoService)', () => {
    assertType<readonly InjectableClass[]>(AppModule._providers);
    assertType<readonly InjectableClass[]>(EmptyModule._providers);
  });

  test('_exports is (InjectableClass | ModuleClass)[] (auto-includes HonoService)', () => {
    assertType<readonly (InjectableClass | ModuleClass)[]>(AppModule._exports);
    assertType<readonly (InjectableClass | ModuleClass)[]>(EmptyModule._exports);
  });

  test('_imports is readonly []', () => {
    assertType<readonly []>(AppModule._imports);
    assertType<readonly []>(EmptyModule._imports);
    assertType<readonly []>(ModuleWithMiddlewares._imports);
  });

  test('re-exported module preserves ModuleClass in _exports', () => {
    assertType<readonly (InjectableClass | ModuleClass)[]>(ReExportModule._exports);
    assertType<readonly ModuleClass[]>(ReExportModule._imports);
  });

  test('exports config accepts ModuleClass from imports', () => {
    // Compile-time: SharedModule is in imports, so it's valid in exports
    // If SharedModule were NOT in imports, this would be a type error
    assertType<HonoModuleClass>(ReExportModule);
  });
});

describe('HonoModuleClass type narrowing', () => {
  test('HonoModule class satisfies HonoModuleClass', () => {
    assertType<HonoModuleClass>(AppModule);
    assertType<HonoModuleClass>(EmptyModule);
  });

  test('plain Module does not satisfy HonoModuleClass', () => {
    // @ts-expect-error — plain Module lacks _isHonoModule and _honoOptions
    assertType<HonoModuleClass>(PlainModule);
  });
});

describe('HonoModuleOptions type', () => {
  test('HonoModuleOptions shape', () => {
    const opts: HonoModuleOptions = { port: 3000, host: '0.0.0.0' };
    assertType<HonoModuleOptions>(opts);
  });

  test('HonoModuleOptions with middlewares', () => {
    const opts: HonoModuleOptions = { middlewares: [], port: 8080 };
    assertType<HonoModuleOptions>(opts);
  });

  test('HonoModuleOptions empty', () => {
    const opts: HonoModuleOptions = {};
    assertType<HonoModuleOptions>(opts);
  });
});

describe('HonoModuleOptionsFactory type', () => {
  test('factory with resolve parameter', () => {
    const factory: HonoModuleOptionsFactory = (resolve) => ({
      port: 3000,
      host: resolve(UserService) ? '0.0.0.0' : 'localhost',
    });
    assertType<HonoModuleOptionsFactory>(factory);
  });

  test('factory returning minimal options', () => {
    const factory: HonoModuleOptionsFactory = () => ({ port: 3000 });
    assertType<HonoModuleOptionsFactory>(factory);
  });
});
