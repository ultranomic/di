import { DI_ERROR_CODE, DIError } from './di-error.ts';
import { SCOPE, type Scope } from './scope.ts';
import type { InjectableClass, InjectEntry, ValidInjectEntries } from './types.ts';

type ExtractInjectObject<TInject extends readonly InjectEntry[]> = {
  readonly [K in TInject[number] as K[0]]: InstanceType<K[1]>;
};

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
}) => {
  const injectEntries = [...(config?.inject ?? [])] as unknown as TInject;
  const seenKeys = new Set<string>();
  for (const [key] of injectEntries) {
    if (seenKeys.has(key)) {
      throw new DIError(DI_ERROR_CODE.DUPLICATE_INJECT_KEY, `Duplicate inject key: "${key}"`);
    }
    seenKeys.add(key);
  }

  const injectClasses = Object.freeze(
    injectEntries.map(([, cls]) => cls),
  ) as InjectClasses<TInject>;

  type InjectObject = ExtractInjectObject<TInject>;
  type Instance = { readonly inject: InjectObject };

  const InjectableBase = class {
    public static readonly _isInjectable = true as const;
    public static readonly _scope: TScope = (config?.scope ?? SCOPE.SINGLETON) as TScope;
    public static readonly _inject: InjectClasses<TInject> = injectClasses;

    public readonly inject: InjectObject;

    public constructor(...deps: { [K in keyof TInject]: InstanceType<TInject[K][1]> }) {
      this.inject = Object.freeze(
        Object.fromEntries(injectEntries.map(([key], index) => [key, deps[index]])),
      ) as InjectObject;
    }
  } as InjectableClass<Instance, InjectClasses<TInject>, TScope>;

  return InjectableBase;
};
