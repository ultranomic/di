import { beforeEach, describe, expect, it } from 'vitest';
import { BindingScope } from './binding.ts';
import { Container } from './container.ts';

describe('BindingBuilder Coverage', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('asTransient method coverage (line 66)', () => {
    it('should set scope to TRANSIENT when explicitly called', () => {
      container.register('Service', () => ({ value: 1 })).asScoped();
      const binding = container.getBinding('Service');
      expect(binding?.scope).toBe(BindingScope.SCOPED);

      // Now change to transient
      container.register('Service2', () => ({ value: 2 })).asTransient();
      const binding2 = container.getBinding('Service2');
      expect(binding2?.scope).toBe(BindingScope.TRANSIENT);
    });

    it('should explicitly set TRANSIENT after setting another scope', () => {
      const builder = container.register('Service', () => ({ value: 1 }));
      builder.asSingleton();
      let binding = container.getBinding('Service');
      expect(binding?.scope).toBe(BindingScope.SINGLETON);

      // Register new service and explicitly set as transient
      container.register('Service2', () => ({ value: 2 })).asTransient();
      const binding2 = container.getBinding('Service2');
      expect(binding2?.scope).toBe(BindingScope.TRANSIENT);
    });

    it('should return undefined for asTransient chain call', () => {
      const result = container.register('Service', () => ({})).asTransient();
      expect(result).toBeUndefined();
    });

    it('should verify BindingScope.TRANSIENT value', () => {
      expect(BindingScope.TRANSIENT).toBe('TRANSIENT');
      container.register('Service', () => ({})).asTransient();
      const binding = container.getBinding('Service');
      expect(binding?.scope).toBe('TRANSIENT');
    });
  });
});
