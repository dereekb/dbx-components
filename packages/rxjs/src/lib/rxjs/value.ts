import { combineLatest, filter, skipWhile, startWith, switchMap, type MonoTypeOperatorFunction, type Observable, of, type OperatorFunction, map, delay, EMPTY } from 'rxjs';
import { type DecisionFunction, type GetterOrValue, getValueFromGetter, isMaybeSo, type MapFunction, type Maybe, type Milliseconds, filterMaybeArrayValues, type MaybeSoStrict } from '@dereekb/util';
import { asObservable, asObservableFromGetter, type MaybeObservableOrValueGetter, type ObservableOrValueGetter, type MaybeObservableOrValue } from './getter';
import { type ObservableDecisionFunction } from './decision';

// MARK: Types
/**
 * Function that checks the input value and returns an observable that emits a boolean.
 */
export type IsCheckFunction<T = unknown> = (value: T) => Observable<boolean>;

/**
 * Function that validates the input value and returns an observable that emits true if the value is valid.
 */
export type IsValidFunction<T = unknown> = IsCheckFunction<T>;

/**
 * Function that checks equality of the input value and returns an observable that emits true if the value is equal.
 */
export type IsEqualFunction<T = unknown> = IsCheckFunction<T>;

/**
 * Function that checks modification status of the input value and returns an observable that emits true if the value is modified.
 */
export type IsModifiedFunction<T = unknown> = IsCheckFunction<T>;

/**
 * Creates an {@link IsModifiedFunction} by inverting the result of an {@link IsEqualFunction}.
 *
 * @param isEqualFunction - equality check function to invert
 * @returns a function that returns true when the value has been modified
 */
export function makeIsModifiedFunction<T>(isEqualFunction: IsEqualFunction<T>): IsModifiedFunction<T> {
  return (value) => isEqualFunction(value).pipe(map((x) => !x));
}

/**
 * Configuration for creating an Observable<IsModifiedFunction>.
 */
export interface MakeIsModifiedFunctionObservableConfig<T = unknown> {
  /**
   * Observable or value of the IsModifiedFunction to use, if applicable.
   */
  readonly isModified?: MaybeObservableOrValue<IsModifiedFunction<T>>;
  /**
   * Observable or value of the IsEqualFunction to use, if applicable.
   */
  readonly isEqual?: MaybeObservableOrValue<IsEqualFunction<T>>;
  /**
   * The default function to use if no other function is provided.
   *
   * Defaults to a function that returns true.
   */
  readonly defaultFunction?: Maybe<IsModifiedFunction<T>>;
}

/**
 * Creates an observable that emits an {@link IsModifiedFunction} derived from the config.
 *
 * Prefers `isModified` over `isEqual` (which is inverted), falling back to `defaultFunction`
 * or a function that always returns true.
 *
 * @param config - configuration with isModified, isEqual, and/or defaultFunction
 * @returns an observable of the resolved IsModifiedFunction
 */
export function makeIsModifiedFunctionObservable<T>(config: MakeIsModifiedFunctionObservableConfig<T>): Observable<IsModifiedFunction<T>> {
  const { isModified, isEqual, defaultFunction } = config;

  return combineLatest([asObservable(isModified), asObservable(isEqual)]).pipe(map(([isModified, isEqual]) => isModified ?? (isEqual ? makeIsModifiedFunction(isEqual) : undefined) ?? defaultFunction ?? (() => of(true))));
}

// MARK: IsCheck
/**
 * Creates a function that returns the value if the check function returns true, otherwise undefined.
 *
 * @param isCheckFunction - optional check function
 * @param defaultValueOnMaybe - default result for null/undefined values
 */
export function makeReturnIfIsFunction<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, defaultValueOnMaybe?: boolean): (value: Maybe<T>) => Observable<Maybe<T>> {
  return (value) => returnIfIs(isCheckFunction, value, defaultValueOnMaybe);
}

/**
 * Returns the value wrapped in an observable if the check function passes, otherwise emits undefined.
 *
 * @param isCheckFunction - optional check function
 * @param value - the value to check
 * @param defaultValueOnMaybe - default result for null/undefined values
 */
export function returnIfIs<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, value: Maybe<T>, defaultValueOnMaybe?: boolean): Observable<Maybe<T>> {
  return checkIs<T>(isCheckFunction, value, defaultValueOnMaybe).pipe(map((x) => (x ? value : undefined)));
}

/**
 * Creates a function that checks a value against the check function and returns an observable boolean.
 *
 * @param isCheckFunction - optional check function
 * @param defaultValueOnMaybe - default result for null/undefined values
 */
export function makeCheckIsFunction<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, defaultValueOnMaybe?: boolean): (value: Maybe<T>) => Observable<boolean> {
  return (value) => checkIs(isCheckFunction, value, defaultValueOnMaybe);
}

/**
 * Evaluates a value against an optional check function, returning an observable boolean.
 *
 * Returns `of(true)` when no check function is provided.
 *
 * @param isCheckFunction - optional check function
 * @param value - the value to check
 * @param defaultValueOnMaybe - default result for null/undefined values (defaults to false)
 */
export function checkIs<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, value: Maybe<T>, defaultValueOnMaybe = false): Observable<boolean> {
  const is: Observable<boolean> = isCheckFunction ? (value != null ? isCheckFunction(value) : of(defaultValueOnMaybe)) : of(true);
  return is;
}

// MARK: Filter
/**
 * RxJS operator that filters out null and undefined values, only passing through defined values.
 */
export function filterMaybe<T>(): OperatorFunction<Maybe<T>, T> {
  return filter(isMaybeSo);
}

/**
 * Equivalent to filterMaybe, but returns a strict MaybeSoStrict<T> value instead of the template type.
 */
export const filterMaybeStrict = filterMaybe as <T>() => OperatorFunction<Maybe<T>, MaybeSoStrict<T>>;

/**
 * RxJS operator that filters out null/undefined elements from an emitted array, keeping only defined values.
 */
export function filterMaybeArray<T>(): OperatorFunction<Maybe<T>[], T[]> {
  return map(filterMaybeArrayValues) as OperatorFunction<Maybe<T>[], T[]>;
}

/**
 * RxJS operator that skips all leading null/undefined emissions, then passes all subsequent values through.
 */
export function skipAllInitialMaybe<T>(): MonoTypeOperatorFunction<T> {
  return skipWhile((x: T) => x == null);
}

/**
 * RxJS operator that skips only the first emission if it is null/undefined, then passes all subsequent values.
 */
export function skipInitialMaybe<T>(): MonoTypeOperatorFunction<T> {
  return skipMaybes(1);
}

/**
 * RxJS operator that skips up to `maxToSkip` null/undefined emissions, then passes all subsequent values.
 *
 * @param maxToSkip - maximum number of null/undefined emissions to skip
 */
export function skipMaybes<T>(maxToSkip: number): MonoTypeOperatorFunction<T> {
  return skipWhile((x: T, i: number) => x == null && i < maxToSkip);
}

/**
 * RxJS operator that switches to the emitted observable if defined, or emits the default value if null/undefined.
 *
 * @param defaultValue - fallback value when the observable is nullish (defaults to undefined)
 * @returns an operator that handles optional observables
 */
export function switchMapMaybeDefault<T = unknown>(defaultValue: Maybe<T> = undefined): OperatorFunction<Maybe<Observable<Maybe<T>>>, Maybe<T>> {
  return switchMap((x: Maybe<Observable<Maybe<T>>>) => {
    if (x != null) {
      return x;
    } else {
      return of(defaultValue);
    }
  });
}

/**
 * Details when to pass the default value through.
 */
export type SwitchMapToDefaultFilterFunction<T> = ObservableDecisionFunction<Maybe<T>>;

/**
 * RxJS operator that emits the source value if defined, or switches to the default observable/getter when
 * the value is nullish (or when the custom `useDefault` decision function returns true).
 *
 * @param defaultObs - default value/observable/getter to use as fallback
 * @param useDefault - optional decision function to determine when to use the default
 * @returns an operator that provides a default for nullish values
 */
export function switchMapToDefault<T = unknown>(defaultObs: MaybeObservableOrValueGetter<T>): OperatorFunction<Maybe<T>, Maybe<T>>;
export function switchMapToDefault<T = unknown>(defaultObs: ObservableOrValueGetter<T>): OperatorFunction<Maybe<T>, T>;
export function switchMapToDefault<T = unknown>(defaultObs: MaybeObservableOrValueGetter<T>, useDefault?: SwitchMapToDefaultFilterFunction<T>): OperatorFunction<Maybe<T>, Maybe<T>>;
export function switchMapToDefault<T = unknown>(defaultObs: MaybeObservableOrValueGetter<T>, useDefault?: SwitchMapToDefaultFilterFunction<T>): OperatorFunction<Maybe<T>, Maybe<T>> {
  const useDefaultFn = useDefault ? useDefault : (x: Maybe<T>) => of(x == null);
  return switchMap((x: Maybe<T>) =>
    useDefaultFn(x).pipe(
      switchMap((useDefault) => {
        if (useDefault) {
          return asObservableFromGetter(defaultObs);
        } else {
          return of(x);
        }
      })
    )
  );
}

export interface SwitchMapObjectConfig<T> {
  readonly defaultGetter?: GetterOrValue<Maybe<T>>;
}

/**
 * RxJS operator that resolves an observable/getter config input into a value, applying defaults
 * for `null`/`undefined`/`true` inputs and emitting `null` for `false`.
 */
export function switchMapObject<T extends object>(config: SwitchMapObjectConfig<T>): OperatorFunction<Maybe<ObservableOrValueGetter<Maybe<T | boolean>>>, Maybe<T>> {
  const { defaultGetter } = config;
  return switchMap((inputConfig: Maybe<ObservableOrValueGetter<Maybe<T | boolean>>>) => {
    const obs: Observable<Maybe<T>> = asObservableFromGetter(inputConfig).pipe(
      map((input) => {
        let config: Maybe<T>;

        if (input == null || input === true) {
          config = defaultGetter ? getValueFromGetter(defaultGetter) : null;
        } else if (input !== false) {
          config = input;
        }

        return config;
      })
    );

    return obs;
  });
}

/**
 * RxJS operator that emits from the given observable/getter when the source boolean is `true`,
 * otherwise emits from the `otherwise` source or `EMPTY`.
 */
export function switchMapWhileTrue<T = unknown>(obs: ObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileTrue<T = unknown>(obs: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileTrue<T = unknown>(obs: ObservableOrValueGetter<T>, otherwise: ObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileTrue<T = unknown>(obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>>;
export function switchMapWhileTrue<T = unknown>(obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>> {
  return switchMapOnBoolean(true, obs, otherwise);
}

/**
 * RxJS operator that emits from the given observable/getter when the source boolean is `false`,
 * otherwise emits from the `otherwise` source or `EMPTY`.
 */
export function switchMapWhileFalse<T = unknown>(obs: ObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileFalse<T = unknown>(obs: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileFalse<T = unknown>(obs: ObservableOrValueGetter<T>, otherwise: ObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileFalse<T = unknown>(obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>>;
export function switchMapWhileFalse<T = unknown>(obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>> {
  return switchMapOnBoolean(false, obs, otherwise);
}

/**
 * RxJS operator that emits from `obs` when the source boolean matches `switchOnValue`,
 * otherwise emits from `otherwise` or `EMPTY`.
 *
 * @param switchOnValue - the boolean value that triggers emitting from `obs`
 * @param obs - observable/getter to emit from when matched
 * @param otherwise - optional observable/getter for the non-matching case
 */
export function switchMapOnBoolean<T = unknown>(switchOnValue: boolean, obs: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapOnBoolean<T = unknown>(switchOnValue: boolean, obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>>;
export function switchMapOnBoolean<T = unknown>(switchOnValue: boolean, obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>> {
  return switchMap((x: boolean) => {
    if (x === switchOnValue) {
      return asObservableFromGetter(obs);
    } else {
      return otherwise != null ? asObservableFromGetter(otherwise) : EMPTY;
    }
  });
}

/**
 * RxJS operator that filters out null/undefined observables and then switches to the remaining ones.
 *
 * Combines {@link filterMaybe} and `switchMap` to only subscribe to non-nullish observables.
 */
export function switchMapFilterMaybe<T = unknown>(): OperatorFunction<Maybe<Observable<Maybe<T>>>, T> {
  return (source: Observable<Maybe<Observable<Maybe<T>>>>) => {
    const subscriber: Observable<T> = source.pipe(
      filterMaybe(),
      switchMap((x) => x)
    ) as Observable<T>;

    return subscriber;
  };
}

/**
 * RxJS operator that switches to the emitted observable if defined, or emits `undefined` when the observable is nullish.
 */
export function switchMapMaybe<T = unknown>(): OperatorFunction<Maybe<Observable<Maybe<T>>>, Maybe<T>> {
  return (source: Observable<Maybe<Observable<Maybe<T>>>>) => {
    const subscriber: Observable<Maybe<T>> = source.pipe(switchMap((x) => (x != null ? x : of(undefined)))) as Observable<Maybe<T>>;
    return subscriber;
  };
}

/**
 * RxJS operator that applies a map function only when the emitted value is non-null/non-undefined.
 *
 * @param mapFn - function to transform defined values
 * @returns an operator that maps defined values and passes through undefined
 */
export function mapMaybe<A, B>(mapFn: MapFunction<A, Maybe<B>>): OperatorFunction<Maybe<A>, Maybe<B>> {
  return mapIf(mapFn as MapFunction<Maybe<A>, Maybe<B>>, isMaybeSo);
}

/**
 * RxJS operator that applies a map function only when the decision function returns true.
 *
 * @param mapFn - function to transform the value
 * @param decision - predicate that determines whether to apply the map
 * @returns an operator that conditionally maps values
 */
export function mapIf<A, B>(mapFn: MapFunction<Maybe<A>, Maybe<B>>, decision: DecisionFunction<Maybe<A>>): OperatorFunction<Maybe<A>, Maybe<B>> {
  return map((x: Maybe<A>) => (decision(x) ? mapFn(x) : undefined));
}

/**
 * Combines both combineLatest with map values to an other value.
 *
 * @param combineObs
 * @param mapFn
 * @returns
 */
export function combineLatestMapFrom<A, B, C>(combineObs: Observable<B>, mapFn: (a: A, b: B) => C): OperatorFunction<A, C> {
  return (obs: Observable<A>) => combineLatest([obs, combineObs]).pipe(map(([a, b]) => mapFn(a, b)));
}

/**
 * Creates an observable that emits a starting value, then a second value after a delay.
 *
 * If the delay is not provided, or is falsy, then the second value is never emitted.
 */
export function emitDelayObs<T>(startWith: T, endWith: T, delayTime: Maybe<Milliseconds>): Observable<T> {
  let obs = of(startWith);

  if (delayTime) {
    obs = obs.pipe(emitAfterDelay(endWith, delayTime));
  }

  return obs;
}

/**
 * Emits a value after a given delay after every new emission.
 */
export function emitAfterDelay<T>(value: T, delayTime: Milliseconds): MonoTypeOperatorFunction<T> {
  return (obs: Observable<T>) => obs.pipe(switchMap((x) => of(value).pipe(delay(delayTime), startWith(x))));
}
