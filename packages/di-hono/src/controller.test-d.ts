import { assertType, describe, test } from 'vite-plus/test';
import { Controller } from './controller.ts';
import type { ControllerClass, RouteDefinition, ValidateTargets } from './types.ts';
import { Injectable } from '@ultranomic/di';

class UserService extends Injectable() {}

class UserController extends Controller({
  path: '/users',
}) {}

class OrderController extends Controller({
  path: '/orders',
  inject: [['userService', UserService]] as const,
}) {}

class DefaultController extends Controller({
  path: '/default',
}) {}

describe('Controller types', () => {
  test('static _path is literal type', () => {
    assertType<'/users'>(UserController._path);
    assertType<'/orders'>(OrderController._path);
    assertType<'/default'>(DefaultController._path);
  });

  test('static _scope is SINGLETON', () => {
    assertType<'SINGLETON'>(UserController._scope);
    assertType<'SINGLETON'>(OrderController._scope);
  });

  test('static _inject metadata is correct', () => {
    assertType<readonly []>(UserController._inject);
    assertType<readonly [typeof UserService]>(OrderController._inject);
  });

  test('route() returns RouteDefinition', () => {
    const instance = new UserController();
    const route = instance.route({
      method: 'GET',
      path: '/',
      handler: (c) => c.json({ ok: true }),
    });
    assertType<RouteDefinition<ValidateTargets, 'GET', '/'>>(route);
  });

  test('route() with validation returns RouteDefinition', () => {
    const instance = new OrderController(new UserService());
    const route = instance.route({
      method: 'POST',
      path: '/',
      validate: {},
      handler: (c) => c.json({ ok: true }),
    });
    assertType<RouteDefinition>(route);
  });

  test('ControllerClass narrows _path', () => {
    assertType<ControllerClass<'/users'>>(UserController);
    assertType<ControllerClass<'/orders'>>(OrderController);
  });
});
