import { SCOPE, type Scope } from './scope.ts';
import type { InjectEntry, ValidInjectEntries, Simplify, InjectableClass } from './types.ts';

export type ToInjectObject<TInject extends readonly InjectEntry[]> = Simplify<{
  readonly [K in TInject[number] as K[0]]: InstanceType<K[1]>;
}>;

type InjectClasses<TInject extends readonly InjectEntry[]> = {
  readonly [K in keyof TInject]: TInject[K][1];
};

/**
 * Mixin factory that turns a plain class into a DI-aware provider.
 * @param {{ scope?: Scope; inject?: TInject }} config - Optional configuration with scope and inject dependencies.
 * @returns {InjectableClass} A base class to extend for your service.
 * @throws {DIError} When duplicate inject keys are detected in the config.
 * @example
 * ```ts
 * class Logger extends Injectable() { log(msg: string) { console.log(msg); } }
 * class UserService extends Injectable({ inject: [['logger', Logger]] }) {}
 * ```
 */
export const Injectable = <
  TScope extends Scope = typeof SCOPE.SINGLETON,
  const TInject extends readonly InjectEntry[] = [],
>(config?: {
  scope?: TScope;
  inject?: ValidInjectEntries<TInject>;
}): InjectableClass<{ readonly inject: ToInjectObject<TInject> }, TInject, TScope> => {
  const scope = (config?.scope ?? SCOPE.SINGLETON) as TScope;
  const inject = (config?.inject ?? []) as TInject;
  //No need to check for duplicated key, we will do it at the type level

  const injectClasses = inject.map(([, cls]) => cls) as InjectClasses<TInject>;

  const InjectableBase = class {
    public static readonly _isInjectable = true as const;
    public static readonly _scope = scope;
    public static readonly _inject = inject;
    public static readonly _injectClasses = injectClasses;

    public readonly inject;

    public constructor(...deps: { [K in keyof TInject]: InstanceType<TInject[K][1]> }) {
      this.inject = Object.fromEntries(
        inject.map(([key], index) => [key, deps[index]]),
      ) as ToInjectObject<TInject>;
    }
  };

  return InjectableBase;
};
