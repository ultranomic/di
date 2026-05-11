import { describe, expect, it } from 'vite-plus/test';
import { SCOPE } from './scope.ts';

describe('SCOPE', () => {
  it('has Singleton value', () => {
    expect(SCOPE.SINGLETON).toBe('SINGLETON');
  });

  it('has Transient value', () => {
    expect(SCOPE.TRANSIENT).toBe('TRANSIENT');
  });

  it('has Request value', () => {
    expect(SCOPE.REQUEST).toBe('REQUEST');
  });

  it('has exactly 3 keys', () => {
    expect(Object.keys(SCOPE)).toHaveLength(3);
  });

  it('values are readonly string literals', () => {
    const scope: Record<string, string> = SCOPE;
    for (const value of Object.values(scope)) {
      expect(typeof value).toBe('string');
    }
  });
});
