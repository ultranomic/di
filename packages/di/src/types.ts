import type { LogLevel } from './log-level.ts';
import type { Scope } from './scope.ts';

export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

type LowercaseLetter =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z';

type Letter = LowercaseLetter | Uppercase<LowercaseLetter>;

type AlphaNumeric = Letter | Digit;

type IsAlphanumeric<T extends string> = T extends ''
  ? true // An empty string at the end of recursion is valid
  : T extends `${AlphaNumeric}${infer Rest}`
    ? IsAlphanumeric<Rest> // If it matches an alphanumeric char, check the rest
    : false; // If it doesn't match, it's invalid

export type ValidIdentifier<T extends string> = T extends `${infer Head}${infer Rest}`
  ? Head extends Letter
    ? IsAlphanumeric<Rest> extends true
      ? T
      : '🚨 ERROR: Contains non-alphanumeric characters 🚨'
    : '🚨 ERROR: First character must be a letter 🚨'
  : '🚨 ERROR: String cannot be empty 🚨';

/** Generic class constructor type. */
// oxlint-disable-next-line typescript/no-explicit-any
export type Constructor<T = unknown> = new (...args: any[]) => T;

/** Minimal InjectableClassBase shape used for forward declarations and internal graph traversal. */
export type InjectableClassBase = Constructor<unknown> & {
  readonly _isInjectable: true;
  readonly _scope: Scope;
  readonly _inject: readonly InjectEntry[];
  readonly _injectClasses: readonly InjectableClassBase[];
};

/** Tuple of `[name, InjectableClassBase]` for declaring injectable dependencies. The name becomes a property on `this.inject`. */
export type InjectEntry = readonly [string, InjectableClassBase];

type _DupKeys<T extends readonly InjectEntry[], Seen extends string = never> = T extends readonly [
  infer First extends InjectEntry,
  ...infer Rest extends InjectEntry[],
]
  ? First[0] extends Seen
    ? First[0] | _DupKeys<Rest, Seen | First[0]>
    : _DupKeys<Rest, Seen | First[0]>
  : never;

export type ValidInjectEntries<T extends readonly InjectEntry[]> = {
  readonly [K in keyof T]: T[K] extends readonly [infer S extends string, ...any[]]
    ? ValidIdentifier<S> extends S
      ? S extends _DupKeys<T>
        ? readonly [`🚨 ERROR: Duplicate inject key "${S}" 🚨`, T[K][1]]
        : T[K]
      : readonly [ValidIdentifier<S>, T[K][1]]
    : T[K];
};

/** A `Constructor` with `_scope` and `_inject` static metadata attached by `Injectable()`. */
export type InjectableClass<
  T = unknown,
  TInject extends readonly InjectEntry[] = readonly InjectEntry[],
  TScope extends Scope = Scope,
> = Constructor<T> &
  Omit<InjectableClassBase, '_scope' | '_inject' | '_injectClasses'> & {
    readonly _scope: TScope;
    readonly _inject: TInject;
    readonly _injectClasses: { readonly [K in keyof TInject]: TInject[K][1] };
  };

/** A `Constructor` with `_name`, `_level`, and `_isLogger` static metadata attached by `Logger()`. */
export type LoggerClass<
  TScope extends Scope = Scope,
  TInject extends readonly InjectEntry[] = readonly InjectEntry[],
> = InjectableClass<unknown, TInject, TScope> & {
  readonly _isLogger: true;
};

/** A `Constructor` with `_providers`, `_exports`, and `_imports` static metadata attached by `Module()`. */
export type ModuleClass = Constructor & {
  readonly _isModule: true;
  readonly _providers: readonly InjectableClass[];
  readonly _exports: readonly (InjectableClass | ModuleClass)[];
  readonly _imports: readonly ModuleClass[];
  readonly _combinedProviders: readonly InjectableClass[];
  readonly _combinedExports: readonly InjectableClass[];
};

/** Optional lifecycle hooks that providers can implement for startup and shutdown. */
export type LifecycleHooks<T = unknown> = {
  onApplicationBootstrap?(container: T): Promise<void> | void;
  onReady?(container: T): Promise<void> | void;
  onStart?(container: T): Promise<void> | void;
  beforeApplicationShutdown?(container: T): Promise<void> | void;
  onStop?(container: T): Promise<void> | void;
};

/** Resolved dependency graph containing a topologically sorted provider list. */
export type GraphResult = { readonly sorted: readonly InjectableClass[] };
