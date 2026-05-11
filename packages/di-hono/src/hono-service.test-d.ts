import { assertType, describe, test } from 'vite-plus/test';
import { HonoService, VALIDATION_ERROR_MESSAGE } from './hono-service.ts';
import { Module } from '@ultranomic/di';
import type { Container as ContainerType } from '@ultranomic/di';
import { Hono } from 'hono';

class _AppModule extends Module({}) {}

describe('HonoService types', () => {
  test('static _isHonoService is literal true', () => {
    assertType<true>(HonoService._isHonoService);
  });

  test('static _scope is SINGLETON', () => {
    assertType<'SINGLETON'>(HonoService._scope);
  });

  test('hono getter returns Hono', () => {
    const service = {} as HonoService;
    assertType<Hono>(service.hono);
  });

  test('port getter returns number | undefined', () => {
    const service = {} as HonoService;
    assertType<number | undefined>(service.port);
  });

  test('host getter returns string | undefined', () => {
    const service = {} as HonoService;
    assertType<string | undefined>(service.host);
  });

  test('onStart is (container: Container) => void', () => {
    const service = {} as HonoService;
    assertType<(container: ContainerType) => void>(service.onStart);
  });

  test('onStop is (container: Container) => void', () => {
    const service = {} as HonoService;
    assertType<(container: ContainerType) => void>(service.onStop);
  });

  test('VALIDATION_ERROR_MESSAGE is literal type', () => {
    assertType<'Validation failed'>(VALIDATION_ERROR_MESSAGE);
  });
});
