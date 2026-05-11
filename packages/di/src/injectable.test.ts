import { describe, expect, it } from 'vite-plus/test';
import { DI_ERROR_CODE } from './di-error.ts';
import { Injectable } from './injectable.ts';
import { SCOPE } from './scope.ts';
import './test-utils.ts';

class ServiceA extends Injectable({ scope: SCOPE.SINGLETON }) {
  public greet() {
    return 'hello';
  }
}

class ServiceB extends Injectable({
  scope: SCOPE.TRANSIENT,
  inject: [['serviceA', ServiceA]],
}) {
  public greet() {
    return this.inject.serviceA.greet();
  }
}

class ServiceC extends Injectable({ scope: SCOPE.REQUEST }) {
  public compute() {
    return 42;
  }
}

class ServiceNoConfig extends Injectable() {
  public greet() {
    return 'no config';
  }
}

class ServiceEmptyDeps extends Injectable({ scope: SCOPE.SINGLETON, inject: [] }) {}

class ServiceMultipleDeps extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [
    ['a', ServiceA],
    ['b', ServiceB],
  ],
}) {
  public greet() {
    return `${this.inject.a.greet()} + ${this.inject.b.greet()}`;
  }
}

class ChildService extends ServiceA {
  public override greet() {
    return 'child hello';
  }
}

class ChildOverrideScope extends Injectable({ scope: SCOPE.TRANSIENT }) {
  public value = 1;
}

class GrandChild extends ChildOverrideScope {
  public override value = 2;
}

describe('Injectable', () => {
  it('sets static _scope on the returned class', () => {
    expect(ServiceA._scope).toBe('SINGLETON');
  });

  it('sets static _inject as empty array when no deps', () => {
    expect(ServiceA._inject).toEqual([]);
  });

  it('sets static _inject with provided dependencies', () => {
    expect(ServiceB._inject).toEqual([ServiceA]);
    expect(ServiceB._inject).toHaveLength(1);
  });

  it('infers tuple type for inject', () => {
    expect(ServiceB._inject[0]).toBe(ServiceA);
  });

  it('infers tuple type for multiple dependencies', () => {
    expect(ServiceMultipleDeps._inject).toEqual([ServiceA, ServiceB]);
    expect(ServiceMultipleDeps._inject).toHaveLength(2);
    expect(ServiceMultipleDeps._inject[0]).toBe(ServiceA);
    expect(ServiceMultipleDeps._inject[1]).toBe(ServiceB);
  });

  it('defaults _inject to empty array when inject is omitted', () => {
    expect(ServiceC._inject).toEqual([]);
  });

  it('supports explicit empty deps array', () => {
    expect(ServiceEmptyDeps._inject).toEqual([]);
  });

  it('creates instances with new', () => {
    const instance = new ServiceA();
    expect(instance.greet()).toBe('hello');
  });

  it('creates independent instances for transient scope', () => {
    const a = new ServiceB(new ServiceA());
    const b = new ServiceB(new ServiceA());
    expect(a).not.toBe(b);
  });

  it('supports multiple services with different scopes', () => {
    expect(ServiceA._scope).toBe('SINGLETON');
    expect(ServiceB._scope).toBe('TRANSIENT');
    expect(ServiceC._scope).toBe('REQUEST');
  });

  it('child class inherits parent scope and inject', () => {
    expect(ChildService._scope).toBe('SINGLETON');
    expect(ChildService._inject).toEqual([]);
  });

  it('child class can override parent behavior', () => {
    const child = new ChildService();
    expect(child.greet()).toBe('child hello');
  });

  it('class hierarchy with intermediate Injectable inherits metadata', () => {
    expect(ChildOverrideScope._scope).toBe('TRANSIENT');
    expect(GrandChild._scope).toBe('TRANSIENT');
  });

  it('defaults to Singleton scope when config is omitted', () => {
    expect(ServiceNoConfig._scope).toBe('SINGLETON');
  });

  it('defaults _inject to empty array when config is omitted', () => {
    expect(ServiceNoConfig._inject).toEqual([]);
  });

  it('creates instances when config is omitted', () => {
    const instance = new ServiceNoConfig();
    expect(instance.greet()).toBe('no config');
  });

  it('auto-assigns injected properties', () => {
    const serviceA = new ServiceA();
    const serviceB = new ServiceB(serviceA);
    expect(serviceB.inject.serviceA).toBe(serviceA);
  });

  it('auto-assigns multiple injected properties', () => {
    const serviceA = new ServiceA();
    const serviceB = new ServiceB(serviceA);
    const serviceMultiple = new ServiceMultipleDeps(serviceA, serviceB);
    expect(serviceMultiple.inject.a).toBe(serviceA);
    expect(serviceMultiple.inject.b).toBe(serviceB);
  });

  it('throws DUPLICATE_INJECT_KEY when inject keys are duplicated', () => {
    expect(() => {
      class _BadService extends Injectable({
        inject: [
          ['a', ServiceA],
          ['a', ServiceA],
        ],
      }) {}
    }).toThrowDIError(DI_ERROR_CODE.DUPLICATE_INJECT_KEY, /Duplicate inject key: "a"/);
  });
});
