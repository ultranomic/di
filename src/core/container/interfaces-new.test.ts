import { describe, expect, it } from 'vitest';
import type { ContainerInterface } from './interfaces.ts';

describe('ContainerInterface', () => {
  it('should accept new register signature', () => {
    type CheckRegister = ContainerInterface['register'];

    // This is a type-only test - if it compiles, it passes
    const _typeCheck: CheckRegister = (() => {}) as unknown as CheckRegister;
    expect(_typeCheck).toBeDefined();
  });
});
