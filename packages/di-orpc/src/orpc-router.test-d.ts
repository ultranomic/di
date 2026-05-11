import { assertType, describe, test } from 'vite-plus/test';
import type { InjectableClass } from '@ultranomic/di';
import { Injectable, SCOPE } from '@ultranomic/di';
import { OrpcRouter } from './orpc-router.ts';
import type { OrpcRouterClass, OrpcRouterConfig } from './types.ts';

class UserService extends Injectable({ scope: SCOPE.SINGLETON }) {}

class UserRouter extends OrpcRouter({
  path: 'users',
  inject: [['userService', UserService]] as const,
}) {
  list = this.orpc.handler(async () => []);
  getById = this.orpc.handler(async () => '');
}

class EmptyRouter extends OrpcRouter({ path: 'empty' }) {}

describe('OrpcRouter types', () => {
  test('static _isOrpcRouter is true', () => {
    assertType<true>(UserRouter._isOrpcRouter);
    assertType<true>(EmptyRouter._isOrpcRouter);
  });

  test('static _orpcPath is literal string', () => {
    assertType<'users'>(UserRouter._orpcPath);
    assertType<'empty'>(EmptyRouter._orpcPath);
  });

  test('static _scope is SINGLETON', () => {
    assertType<'SINGLETON'>(UserRouter._scope);
    assertType<'SINGLETON'>(EmptyRouter._scope);
  });

  test('static _inject is correct type', () => {
    assertType<readonly [readonly ['userService', typeof UserService]]>(UserRouter._inject);
    assertType<readonly never[]>(EmptyRouter._inject);
  });

  test('OrpcRouterClass narrows _orpcPath', () => {
    assertType<OrpcRouterClass<'users'>>(UserRouter);
    assertType<OrpcRouterClass<'empty'>>(EmptyRouter);
  });

  test('OrpcRouterClass extends InjectableClass', () => {
    assertType<InjectableClass>(UserRouter);
    assertType<InjectableClass>(EmptyRouter);
  });

  test('OrpcRouterConfig has path and optional inject', () => {
    assertType<OrpcRouterConfig<'users'>>({ path: 'users' });
    assertType<OrpcRouterConfig<'users', readonly [readonly ['userService', typeof UserService]]>>({
      path: 'users',
      inject: [['userService', UserService]] as const,
    });
  });

  test('instance has orpc builder', () => {
    class ExposedRouter extends OrpcRouter({
      path: 'users',
      inject: [['userService', UserService]] as const,
    }) {
      public getOrpc() {
        return this.orpc;
      }
    }
    const instance = new ExposedRouter(new UserService());
    assertType<object>(instance.getOrpc());
  });

  test('instance has inject property', () => {
    const instance = new UserRouter(new UserService());
    assertType<{ readonly userService: UserService }>(instance.inject);
  });
});
