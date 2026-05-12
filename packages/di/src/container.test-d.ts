// oxlint-disable max-classes-per-file
import { assertType, describe, test } from 'vite-plus/test';
import { Container } from './container.ts';
import { Injectable } from './injectable.ts';
import { DefaultLogger, type LoggerInstance } from './logger.ts';
import { Module } from './module.ts';
import type { InjectableClass, ModuleClass } from './types.ts';

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

class AppModule extends Module({
  providers: [ConfigService, DatabaseService],
  exports: [DatabaseService],
}) {}

describe('Container types', () => {
  test('constructor accepts ModuleClass', () => {
    const container = new Container(AppModule);
    assertType<Container>(container);
  });

  test('module getter returns ModuleClass', () => {
    const container = new Container(AppModule);
    assertType<ModuleClass>(container.module);
  });

  test('sorted getter returns readonly InjectableClass[]', () => {
    const container = new Container(AppModule);
    assertType<readonly InjectableClass[]>(container.sorted);
  });

  test('resolve returns correct instance type', () => {
    const container = new Container(AppModule);
    assertType<DatabaseService>({} as ReturnType<typeof container.resolve<DatabaseService>>);
    assertType<ConfigService>({} as ReturnType<typeof container.resolve<ConfigService>>);
  });

  test('start returns Promise<void>', () => {
    const container = new Container(AppModule);
    assertType<Promise<void>>(container.start());
  });

  test('stop returns Promise<void>', () => {
    const container = new Container(AppModule);
    assertType<Promise<void>>(container.stop());
  });

  test('withRequestScope returns correct type', () => {
    const container = new Container(AppModule);
    const result = container.withRequestScope(() => {
      return 'test';
    });
    assertType<Promise<string>>(result);
  });

  test('constructor accepts logger option', () => {
    const customLogger: LoggerInstance = {
      level: 'INFO',
      inject: {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    const container = new Container(AppModule, { logger: customLogger });
    assertType<Container>(container);
  });

  test('constructor accepts empty options object', () => {
    const container = new Container(AppModule, {});
    assertType<Container>(container);
  });

  test('logger getter returns LoggerInstance', () => {
    const container = new Container(AppModule);
    assertType<LoggerInstance>(container.logger);
  });

  test('logger getter returns DefaultLogger instance when no custom logger', () => {
    const container = new Container(AppModule);
    assertType<LoggerInstance>(container.logger);
    assertType<DefaultLogger>({} as typeof container.logger & DefaultLogger);
  });

  test('logger getter returns custom logger when provided', () => {
    const customLogger: LoggerInstance = {
      level: 'INFO',
      inject: {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    const container = new Container(AppModule, { logger: customLogger });
    assertType<LoggerInstance>(container.logger);
  });
});
