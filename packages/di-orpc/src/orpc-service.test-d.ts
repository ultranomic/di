import { assertType, describe, test } from 'vite-plus/test';
import type { Container as ContainerType, InjectableClass } from '@ultranomic/di';
import { Container, Module } from '@ultranomic/di';
import type { StandardRPCHandler } from '@orpc/server/standard';
import { OrpcModule } from './orpc-module.ts';
import { OrpcService } from './orpc-service.ts';

class AppModule extends Module({ imports: [OrpcModule()] }) {}

describe('OrpcService types', () => {
  test('static _scope is SINGLETON', () => {
    assertType<'SINGLETON'>(OrpcService._scope);
  });

  test('static _isInjectable is true', () => {
    assertType<true>(OrpcService._isInjectable);
  });

  test('static _inject is empty array', () => {
    assertType<readonly []>(OrpcService._inject);
  });

  test('handler getter returns StandardRPCHandler', () => {
    const service = new OrpcService();
    assertType<StandardRPCHandler<any>>(service.handler);
  });

  test('onReady accepts Container', () => {
    const service = new OrpcService();
    assertType<(container: ContainerType) => void>(service.onReady);
  });

  test('onStop accepts Container', () => {
    const service = new OrpcService();
    assertType<(container: ContainerType) => void>(service.onStop);
  });

  test('OrpcService is InjectableClass', () => {
    assertType<InjectableClass>(OrpcService);
  });

  test('Container.resolve returns OrpcService instance', () => {
    const container = new Container(AppModule);
    const service = container.resolve(OrpcService);
    assertType<OrpcService>(service);
  });
});
