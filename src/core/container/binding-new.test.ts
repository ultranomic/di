import { describe, expect, it } from 'vitest';
import { Scope } from './binding.ts';

describe('Scope', () => {
  it('should have SINGLETON value', () => {
    expect(Scope.SINGLETON).toBe('singleton');
  });

  it('should have TRANSIENT value', () => {
    expect(Scope.TRANSIENT).toBe('transient');
  });

  it('should have SCOPED value', () => {
    expect(Scope.SCOPED).toBe('scoped');
  });
});
