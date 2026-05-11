import type { InjectableClass } from '@ultranomic/di';
import { describe, expect, it } from 'vite-plus/test';
import type { StandardHandlerPlugin } from '@orpc/server/standard';
import { OrpcModule } from './orpc-module.ts';
import { OrpcService } from './orpc-service.ts';

describe('OrpcModule', () => {
  it('adds _isOrpcModule static marker', () => {
    const mod = OrpcModule();
    expect(mod._isOrpcModule).toBe(true);
  });

  it('adds _orpcOptions static', () => {
    const mod = OrpcModule();
    expect(typeof mod._orpcOptions).toBe('function');
  });

  it('_providers always contains exactly [OrpcService]', () => {
    const mod = OrpcModule();
    expect(mod._providers).toEqual([OrpcService]);
  });

  it('_exports always contains exactly [OrpcService]', () => {
    const mod = OrpcModule();
    expect(mod._exports).toEqual([OrpcService]);
  });

  it('_imports is []', () => {
    const mod = OrpcModule();
    expect(mod._imports).toEqual([]);
  });

  it('extends Module (has _providers, _exports, _imports)', () => {
    const mod = OrpcModule();
    expect(Array.isArray(mod._providers)).toBe(true);
    expect(Array.isArray(mod._exports)).toBe(true);
    expect(Array.isArray(mod._imports)).toBe(true);
  });

  it('default prefix is /rpc', () => {
    const mod = OrpcModule();
    const options = mod._orpcOptions(<T>(_cls: InjectableClass<T>): T => ({}) as T);
    expect(options.prefix).toBe('/rpc');
  });

  it('custom prefix overrides default', () => {
    const mod = OrpcModule({ prefix: '/api' });
    const options = mod._orpcOptions(<T>(_cls: InjectableClass<T>): T => ({}) as T);
    expect(options.prefix).toBe('/api');
  });

  it('options factory receives resolve function', () => {
    let receivedResolve = false;
    const mod = OrpcModule({
      options: (resolve) => {
        receivedResolve = typeof resolve === 'function';
        return { prefix: '/custom' };
      },
    });
    mod._orpcOptions(<T>(_cls: InjectableClass<T>): T => ({}) as T);
    expect(receivedResolve).toBe(true);
  });

  it('custom options factory overrides default prefix', () => {
    const mod = OrpcModule({
      options: () => ({ prefix: '/custom' }),
    });
    const options = mod._orpcOptions(<T>(_cls: InjectableClass<T>): T => ({}) as T);
    expect(options.prefix).toBe('/custom');
  });

  it('passes plugins through default options factory', () => {
    const plugin: StandardHandlerPlugin<Record<PropertyKey, unknown>> = {};
    const mod = OrpcModule({ plugins: [plugin] });
    const options = mod._orpcOptions(<T>(_cls: InjectableClass<T>): T => ({}) as T);
    expect(options.plugins).toEqual([plugin]);
  });

  it('passes errorInterceptor through default options factory', () => {
    const interceptor = (_error: unknown, _context: unknown) => ({}) as never;
    const mod = OrpcModule({ errorInterceptor: interceptor });
    const options = mod._orpcOptions(<T>(_cls: InjectableClass<T>): T => ({}) as T);
    expect(options.errorInterceptor).toBe(interceptor);
  });

  it('OrpcModule() with no args works', () => {
    const mod = OrpcModule();
    expect(mod._isOrpcModule).toBe(true);
    expect(mod._providers).toEqual([OrpcService]);
    expect(mod._exports).toEqual([OrpcService]);
    expect(mod._imports).toEqual([]);
  });

  it('OrpcModule with custom config works', () => {
    const plugin: StandardHandlerPlugin<Record<PropertyKey, unknown>> = {};
    const interceptor = (_error: unknown, _context: unknown) => ({}) as never;
    const mod = OrpcModule({ prefix: '/api', plugins: [plugin], errorInterceptor: interceptor });
    expect(mod._isOrpcModule).toBe(true);
    const options = mod._orpcOptions(<T>(_cls: InjectableClass<T>): T => ({}) as T);
    expect(options.prefix).toBe('/api');
    expect(options.plugins).toEqual([plugin]);
    expect(options.errorInterceptor).toBe(interceptor);
  });
});
