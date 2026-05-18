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
 * @param isEqualFunction - Equality check function to invert.
 * @returns Predicate that reports true whenever the underlying equality check signals inequality.
 *
 * @__NO_SIDE_EFFECTS__
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
 * @param config - Configuration with isModified, isEqual, and/or defaultFunction.
 * @returns An observable of the resolved IsModifiedFunction.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeIsModifiedFunctionObservable<T>(config: MakeIsModifiedFunctionObservableConfig<T>): Observable<IsModifiedFunction<T>> {
  const { isModified, isEqual, defaultFunction } = config;

  return combineLatest([asObservable(isModified), asObservable(isEqual)]).pipe(map(([isModified, isEqual]) => isModified ?? (isEqual ? makeIsModifiedFunction(isEqual) : undefined) ?? defaultFunction ?? (() => of(true))));
}

// MARK: IsCheck
/**
 * Creates a function that returns the value if the check function returns true, otherwise undefined.
 *
 * @param isCheckFunction - Optional check function.
 * @param defaultValueOnMaybe - Default result for null/undefined values.
 * @returns Function that yields the input value when it passes the check, or undefined otherwise.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeReturnIfIsFunction<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, defaultValueOnMaybe?: boolean): (value: Maybe<T>) => Observable<Maybe<T>> {
  return (value) => returnIfIs(isCheckFunction, value, defaultValueOnMaybe);
}

/**
 * Returns the value wrapped in an observable if the check function passes, otherwise emits undefined.
 *
 * @param isCheckFunction - Optional check function.
 * @param value - The value to check.
 * @param defaultValueOnMaybe - Default result for null/undefined values.
 * @returns An observable that emits the value if the check passes, or undefined otherwise.
 */
export function returnIfIs<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, value: Maybe<T>, defaultValueOnMaybe?: boolean): Observable<Maybe<T>> {
  return checkIs<T>(isCheckFunction, value, defaultValueOnMaybe).pipe(map((x) => (x ? value : undefined)));
}

/**
 * Creates a function that checks a value against the check function and returns an observable boolean.
 *
 * @param isCheckFunction - Optional check function.
 * @param defaultValueOnMaybe - Default result for null/undefined values.
 * @returns Function that emits whether the supplied value passes the check, falling back to the default for missing values.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeCheckIsFunction<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, defaultValueOnMaybe?: boolean): (value: Maybe<T>) => Observable<boolean> {
  return (value) => checkIs(isCheckFunction, value, defaultValueOnMaybe);
}

/**
 * Evaluates a value against an optional check function, returning an observable boolean.
 *
 * Returns `of(true)` when no check function is provided.
 *
 * @param isCheckFunction - Optional check function.
 * @param value - The value to check.
 * @param defaultValueOnMaybe - Default result for null/undefined values (defaults to false)
 * @returns An observable boolean indicating whether the value passes the check.
 */
export function checkIs<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, value: Maybe<T>, defaultValueOnMaybe = false): Observable<boolean> {
  const is: Observable<boolean> = isCheckFunction ? (value != null ? isCheckFunction(value) : of(defaultValueOnMaybe)) : of(true);
  return is;
}

// MARK: Filter
/**
 * RxJS operator that filters out null and undefined values, only passing through defined values.
 *
 * @returns Operator that filters out null and undefined emissions.
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
 *
 * @returns Operator that maps each emitted array to a version with null/undefined elements removed.
 */
export function filterMaybeArray<T>(): OperatorFunction<Maybe<T>[], T[]> {
  return map(filterMaybeArrayValues);
}

/**
 * RxJS operator that skips all leading null/undefined emissions, then passes all subsequent values through.
 *
 * @returns Operator that skips all null/undefined emissions at the start of the stream.
 */
export function skipAllInitialMaybe<T>(): MonoTypeOperatorFunction<T> {
  return skipWhile((x: T) => x == null);
}

/**
 * RxJS operator that skips only the first emission if it is null/undefined, then passes all subsequent values.
 *
 * @returns Operator that skips the first null/undefined emission if it occurs at the start of the stream.
 */
export function skipInitialMaybe<T>(): MonoTypeOperatorFunction<T> {
  return skipMaybes(1);
}

/**
 * RxJS operator that skips up to `maxToSkip` null/undefined emissions, then passes all subsequent values.
 *
 * @param maxToSkip - Maximum number of null/undefined emissions to skip.
 * @returns Operator that skips the first N null/undefined emissions from the stream.
 */
export function skipMaybes<T>(maxToSkip: number): MonoTypeOperatorFunction<T> {
  return skipWhile((x: T, i: number) => x == null && i < maxToSkip);
}

/**
 * RxJS operator that switches to the emitted observable if defined, or emits the default value if null/undefined.
 *
 * @param defaultValue - Fallback value when the observable is nullish (defaults to undefined)
 * @returns An operator that handles optional observables.
 */
export function switchMapMaybeDefault<T = unknown>(defaultValue: Maybe<T> = undefined): OperatorFunction<Maybe<Observable<Maybe<T>>>, Maybe<T>> {
  return switchMap((x: Maybe<Observable<Maybe<T>>>) => x ?? of(defaultValue));
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
  const useDefaultFn = useDefault ?? ((x: Maybe<T>) => of(x == null));
  return switchMap((x: Maybe<T>) =>
    useDefaultFn(x).pipe(
      switchMap((useDefault) => {
        return useDefault ? asObservableFromGetter(defaultObs) : of(x);
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
 *
 * @param config - Configuration providing an optional default getter for null/undefined/true inputs.
 * @returns Operator that resolves each emitted getter into a value, using the default for nullish or true inputs.
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
 *
 * @param obs - observable or getter to subscribe to when the source emits `true`
 * @returns operator that switches to the given source when the boolean is true
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
 *
 * @param obs - observable or getter to subscribe to when the source emits `false`
 * @returns operator that switches to the given source when the boolean is false
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
 * @returns operator that switches to the appropriate source based on the emitted boolean value
 */
export function switchMapOnBoolean<T = unknown>(switchOnValue: boolean, obs: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapOnBoolean<T = unknown>(switchOnValue: boolean, obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>>;
export function switchMapOnBoolean<T = unknown>(switchOnValue: boolean, obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>> {
  return switchMap((x: boolean) => {
    let result: Observable<Maybe<T>>;

    if (x === switchOnValue) {
      result = asObservableFromGetter(obs);
    } else {
      result = otherwise == null ? EMPTY : asObservableFromGetter(otherwise);
    }

    return result;
  });
}

/**
 * RxJS operator that filters out null/undefined observables and then switches to the remaining ones.
 *
 * Combines {@link filterMaybe} and `switchMap` to only subscribe to non-nullish observables.
 *
 * @returns Operator that filters nullish observables and subscribes to the non-nullish ones.
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
 *
 * @returns Operator that switches to the emitted observable or emits undefined for null/undefined inputs.
 */
export function switchMapMaybe<T = unknown>(): OperatorFunction<Maybe<Observable<Maybe<T>>>, Maybe<T>> {
  return (source: Observable<Maybe<Observable<Maybe<T>>>>) => {
    const subscriber: Observable<Maybe<T>> = source.pipe(switchMap((x) => x ?? of(undefined)));
    return subscriber;
  };
}

/**
 * RxJS operator that applies a map function only when the emitted value is non-null/non-undefined.
 *
 * @param mapFn - Function to transform defined values.
 * @returns An operator that maps defined values and passes through undefined.
 */
export function mapMaybe<A, B>(mapFn: MapFunction<A, Maybe<B>>): OperatorFunction<Maybe<A>, Maybe<B>> {
  return mapIf(mapFn as MapFunction<Maybe<A>, Maybe<B>>, isMaybeSo);
}

/**
 * RxJS operator that applies a map function only when the decision function returns true.
 *
 * @param mapFn - Function to transform the value.
 * @param decision - Predicate that determines whether to apply the map.
 * @returns An operator that conditionally maps values.
 */
export function mapIf<A, B>(mapFn: MapFunction<Maybe<A>, Maybe<B>>, decision: DecisionFunction<Maybe<A>>): OperatorFunction<Maybe<A>, Maybe<B>> {
  return map((x: Maybe<A>) => (decision(x) ? mapFn(x) : undefined));
}

/**
 * Combines the source observable with another observable via `combineLatest`, then maps the pair to a result.
 *
 * @param combineObs - The secondary observable to combine with the source.
 * @param mapFn - Function that maps the source value and combined value to the output.
 * @returns Operator that combines the source with `combineObs` and maps each pair using `mapFn`
 */
export function combineLatestMapFrom<A, B, C>(combineObs: Observable<B>, mapFn: (a: A, b: B) => C): OperatorFunction<A, C> {
  return (obs: Observable<A>) => combineLatest([obs, combineObs]).pipe(map(([a, b]) => mapFn(a, b)));
}

/**
 * Creates an observable that emits a starting value, then a second value after a delay.
 *
 * If the delay is not provided, or is falsy, then the second value is never emitted.
 *
 * @param startWith - The value to emit immediately.
 * @param endWith - The value to emit after the delay.
 * @param delayTime - Optional delay in milliseconds before emitting the second value.
 * @returns An observable that emits `startWith` immediately and `endWith` after the delay (if provided)
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
 *
 * @param value - The value to emit after the delay.
 * @param delayTime - Duration in milliseconds before emitting the value.
 * @returns Operator that appends the given value after each source emission with the specified delay.
 */
export function emitAfterDelay<T>(value: T, delayTime: Milliseconds): MonoTypeOperatorFunction<T> {
  return (obs: Observable<T>) => obs.pipe(switchMap((x) => of(value).pipe(delay(delayTime), startWith(x))));
}
