import { expect } from "vite-plus/test";
import { DIError, type DIErrorCode } from "./di-error.ts";

declare module "vite-plus/test" {
  // oxlint-disable-next-line typescript/consistent-type-definitions, typescript/no-explicit-any
  interface Assertion<T = any> {
    toThrowDIError(code: DIErrorCode, pattern?: RegExp): T;
  }
}

expect.extend({
  toThrowDIError(received: () => unknown, code: DIErrorCode, pattern?: RegExp) {
    try {
      const result = received();
      if (result instanceof Promise) {
        return {
          pass: false,
          message: () =>
            `toThrowDIError does not support async callbacks. Use the .catch() pattern: const err = await fn().catch(e => e); expect(() => { throw err }).toThrowDIError(...)`,
        };
      }
      /* v8 ignore next -- no-throw branch: function returned without error */
      return {
        pass: false,
        message: () =>
          `Expected function to throw DIError with code "${code}"${pattern ? ` matching ${pattern}` : ""}`,
      };
    } catch (e: unknown) {
      if (!(e instanceof DIError)) {
        const error = e instanceof Error ? e : new Error(String(e));
        return {
          pass: false,
          message: () => `Expected DIError but got ${error.constructor.name}: ${error.message}`,
        };
      }
      if (e.code !== code) {
        return {
          pass: false,
          message: () => `Expected DIError code "${code}" but got "${e.code}"`,
        };
      }
      if (pattern && !pattern.test(e.message)) {
        return {
          pass: false,
          message: () => `Expected DIError message to match ${pattern} but got "${e.message}"`,
        };
      }
      return { pass: true, message: () => "OK" };
    }
  },
});
