import { describe, expectTypeOf, it } from 'vite-plus/test';
import type { InjectableClass, InjectEntry, ModuleClass } from '@ultranomic/di';
import type {
  ErrorInterceptor,
  OrpcMiddlewareClass,
  OrpcMiddlewareConfig,
  OrpcModuleClass,
  OrpcModuleConfig,
  OrpcModuleOptions,
  OrpcModuleOptionsFactory,
  OrpcRouterClass,
  OrpcRouterConfig,
} from './types.ts';

describe('types', () => {
  it('OrpcRouterClass has required static properties', () => {
    expectTypeOf<OrpcRouterClass>().toMatchTypeOf<InjectableClass>();
    expectTypeOf<OrpcRouterClass>().toHaveProperty('_isOrpcRouter');
    expectTypeOf<OrpcRouterClass>().toHaveProperty('_orpcPath');
  });

  it('OrpcMiddlewareClass has required static properties', () => {
    expectTypeOf<OrpcMiddlewareClass>().toMatchTypeOf<InjectableClass>();
    expectTypeOf<OrpcMiddlewareClass>().toHaveProperty('_isOrpcMiddleware');
  });

  it('OrpcModuleClass has required static properties', () => {
    expectTypeOf<OrpcModuleClass>().toMatchTypeOf<ModuleClass>();
    expectTypeOf<OrpcModuleClass>().toHaveProperty('_isOrpcModule');
    expectTypeOf<OrpcModuleClass>().toHaveProperty('_orpcOptions');
  });

  it('OrpcModuleOptions accepts expected shape', () => {
    expectTypeOf<OrpcModuleOptions>().toMatchTypeOf<{
      readonly prefix?: string;
      readonly plugins?: readonly unknown[];
      readonly errorInterceptor?: ErrorInterceptor;
    }>();
  });

  it('OrpcModuleOptionsFactory is callable with resolve', () => {
    expectTypeOf<OrpcModuleOptionsFactory>().toBeCallableWith(
      <T>(_cls: InjectableClass<T>): T => ({}) as T,
    );
  });

  it('OrpcRouterConfig has path and optional inject', () => {
    expectTypeOf<OrpcRouterConfig>().toMatchTypeOf<{
      readonly path: string;
      readonly inject?: readonly InjectEntry[];
    }>();
  });

  it('OrpcMiddlewareConfig has optional inject', () => {
    expectTypeOf<OrpcMiddlewareConfig>().toMatchTypeOf<{
      readonly inject?: readonly InjectEntry[];
    }>();
  });

  it('OrpcModuleConfig has prefix, plugins, errorInterceptor, options', () => {
    expectTypeOf<OrpcModuleConfig>().toMatchTypeOf<{
      readonly prefix?: string;
      readonly plugins?: readonly unknown[];
      readonly errorInterceptor?: ErrorInterceptor;
      readonly options?: OrpcModuleOptionsFactory;
    }>();
  });
});
