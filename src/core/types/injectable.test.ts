import { describe, expect, it } from 'vitest';
import { Injectable } from './injectable.ts';

describe('Injectable', () => {
  it('should be an abstract class that can be extended', () => {
    // Injectable should be extendable
    class TestService extends Injectable {
      testMethod() {
        return 'test';
      }
    }

    const service = new TestService();
    expect(service.testMethod()).toBe('test');
  });

  it('should allow static inject property', () => {
    class TestService extends Injectable {
      static readonly inject = [] as const;
    }

    expect(TestService.inject).toEqual([]);
  });

  it('should allow static inject property with dependencies', () => {
    class Dependency extends Injectable {
      static readonly inject = [] as const;
    }

    class TestService extends Injectable {
      static readonly inject = [Dependency] as const;
    }

    expect(TestService.inject).toEqual([Dependency]);
  });

  it('should work with constructor injection', () => {
    class Dependency extends Injectable {
      static readonly inject = [] as const;
      getValue() {
        return 'dependency-value';
      }
    }

    class TestService extends Injectable {
      static readonly inject = [Dependency] as const;
      constructor(private dep: Dependency) {
        super();
      }

      getValue() {
        return this.dep.getValue();
      }
    }

    const dep = new Dependency();
    const service = new TestService(dep);
    expect(service.getValue()).toBe('dependency-value');
  });

  it('should allow optional static inject property', () => {
    class TestService extends Injectable {
      // No inject property
      testMethod() {
        return 'test';
      }
    }

    expect(TestService.inject).toBeUndefined();
  });

  it('should allow multiple levels of inheritance', () => {
    class BaseService extends Injectable {
      static readonly inject = [] as const;
      baseMethod() {
        return 'base';
      }
    }

    class ExtendedService extends BaseService {
      extendedMethod() {
        return 'extended';
      }
    }

    const service = new ExtendedService();
    expect(service.baseMethod()).toBe('base');
    expect(service.extendedMethod()).toBe('extended');
  });
});
