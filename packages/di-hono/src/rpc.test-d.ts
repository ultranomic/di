import { assertType, describe, test } from 'vite-plus/test';
import { Controller } from './controller.ts';
import { HonoModule } from './hono-module.ts';
import type { HonoRpcType } from './rpc.ts';
import { Injectable, Module } from '@ultranomic/di';
import type { Hono } from 'hono';

class TestService extends Injectable() {}

class TestController extends Controller({
  path: '/test',
}) {
  getList = this.route({
    method: 'GET',
    path: '/',
    handler: async (c) => c.json({ items: [] as string[] }),
  });

  createItem = this.route({
    method: 'POST',
    path: '/',
    handler: async (c) => c.json({ id: '1', name: 'test' }, 201),
  });
}

class OtherController extends Controller({
  path: '/other',
}) {
  getItem = this.route({
    method: 'GET',
    path: '/:id',
    handler: async (c) => c.json({ id: '1' }),
  });
}

class TestHonoModule extends HonoModule({
  options: () => ({ port: 3000, host: '0.0.0.0' }),
}) {}

class TestModule extends Module({
  providers: [TestService, TestController, OtherController],
  exports: [TestController, OtherController],
}) {}

class AppModule extends Module({
  imports: [TestHonoModule, TestModule],
}) {}

describe('HonoRpcType', () => {
  test('produces Hono type', () => {
    type AppType = HonoRpcType<typeof AppModule>;
    type Result = AppType extends Hono<any, any, any> ? true : false;
    assertType<true>({} as Result);
  });

  test('extracts routes from controllers', () => {
    type AppType = HonoRpcType<typeof AppModule>;
    type AppSchema = AppType extends Hono<any, infer S, any> ? S : never;

    type HasTestRoute = '/test' extends keyof AppSchema ? true : false;
    type HasOtherRoute = '/other/:id' extends keyof AppSchema ? true : false;

    assertType<true>({} as HasTestRoute);
    assertType<true>({} as HasOtherRoute);
  });

  test('captures response types', () => {
    type AppType = HonoRpcType<typeof AppModule>;
    type AppSchema = AppType extends Hono<any, infer S, any> ? S : never;

    type TestGetEndpoint = AppSchema['/test']['$get'];
    type TestGetOutput = TestGetEndpoint extends { output: infer O } ? O : never;

    assertType<{ items: string[] }>({} as TestGetOutput);
  });
});
