import { combineLatest, filter, skipWhile, startWith, switchMap, type MonoTypeOperatorFunction, type Observable, of, type OperatorFunction, map, delay, EMPTY } from 'rxjs';
import { type DecisionFunction, type GetterOrValue, getValueFromGetter, isMaybeSo, type MapFunction, type Maybe, filterMaybeArrayValues } from '@dereekb/util';
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
 * Creates an IsModifiedFunction from an IsEqualFunction, or from IsModifiedFunctionInput.
 *
 * @param isEqualFunction
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
 * Creates an Observable<IsModifiedFunction> from the input config.
 *
 * @param config MakeIsModifiedFunctionObservableConfig.
 * @returns Observable<IsModifiedFunction<T>>
 */
export function makeIsModifiedFunctionObservable<T>(config: MakeIsModifiedFunctionObservableConfig<T>): Observable<IsModifiedFunction<T>> {
  const { isModified, isEqual, defaultFunction } = config;

  return combineLatest([asObservable(isModified), asObservable(isEqual)]).pipe(map(([isModified, isEqual]) => isModified ?? (isEqual ? makeIsModifiedFunction(isEqual) : undefined) ?? defaultFunction ?? (() => of(true))));
}

// MARK: IsCheck
export function makeReturnIfIsFunction<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, defaultValueOnMaybe?: boolean): (value: Maybe<T>) => Observable<Maybe<T>> {
  return (value) => returnIfIs(isCheckFunction, value, defaultValueOnMaybe);
}

export function returnIfIs<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, value: Maybe<T>, defaultValueOnMaybe?: boolean): Observable<Maybe<T>> {
  return checkIs<T>(isCheckFunction, value, defaultValueOnMaybe).pipe(map((x) => (x ? value : undefined)));
}

export function makeCheckIsFunction<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, defaultValueOnMaybe?: boolean): (value: Maybe<T>) => Observable<boolean> {
  return (value) => checkIs(isCheckFunction, value, defaultValueOnMaybe);
}

export function checkIs<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, value: Maybe<T>, defaultValueOnMaybe = false): Observable<boolean> {
  const is: Observable<boolean> = isCheckFunction ? (value != null ? isCheckFunction(value) : of(defaultValueOnMaybe)) : of(true);
  return is;
}

// MARK: Filter
/**
 * Observable filter that filters maybe value that are defined.
 */
export function filterMaybe<T>(): OperatorFunction<Maybe<T>, T> {
  return filter(isMaybeSo);
}

/**
 * Observable filter that filters maybe value from the input array of maybe values
 */
export function filterMaybeArray<T>(): OperatorFunction<Maybe<T>[], T[]> {
  return map(filterMaybeArrayValues) as OperatorFunction<Maybe<T>[], T[]>;
}

/**
 * Skips all initial maybe values, and then returns all values after the first non-null/undefined value is returned.
 */
export function skipFirstMaybe<T>(): MonoTypeOperatorFunction<T> {
  return skipWhile((x: T) => x == null);
}

/**
 * Provides a switchMap that will emit the observable if the observable is defined, otherwise will return the default value.
 *
 * @param defaultValue
 * @returns
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
 * Provides a switchMap that will emit the observable value if the observable is defined, otherwise will use the input default.
 *
 * @param defaultValue
 * @returns
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
  defaultGetter?: GetterOrValue<Maybe<T>>;
}

/**
 * Provides a switchMap that retrieves and emits the value from the observable, unless the value is null/undefined/true in which case it emits the default value. If the value is false, null is emitted.
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
 * Provides a switchMap that will emit from the input observable if the value is true, otherwise emits the otherwise value or empty.
 *
 * @param defaultValue
 * @returns
 */
export function switchMapWhileTrue<T = unknown>(obs: ObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileTrue<T = unknown>(obs: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileTrue<T = unknown>(obs: ObservableOrValueGetter<T>, otherwise: ObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileTrue<T = unknown>(obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>>;
export function switchMapWhileTrue<T = unknown>(obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>> {
  return switchMapOnBoolean(true, obs, otherwise);
}

/**
 * Provides a switchMap that will emit from the input observable if the value is false, otherwise emits the otherwise value or empty.
 *
 * @param defaultValue
 * @returns
 */
export function switchMapWhileFalse<T = unknown>(obs: ObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileFalse<T = unknown>(obs: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileFalse<T = unknown>(obs: ObservableOrValueGetter<T>, otherwise: ObservableOrValueGetter<T>): OperatorFunction<boolean, T>;
export function switchMapWhileFalse<T = unknown>(obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>>;
export function switchMapWhileFalse<T = unknown>(obs: MaybeObservableOrValueGetter<T>, otherwise?: MaybeObservableOrValueGetter<T>): OperatorFunction<boolean, Maybe<T>> {
  return switchMapOnBoolean(false, obs, otherwise);
}

/**
 * Provides a switchMap that will emit from the input observable if the value matches the switchOnValue, otherwise emits the otherwise value or empty.
 *
 * @param defaultValue
 * @returns
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
 * Combines both filterMaybe and switchMap to build a subscriber that emits values only from a concrete Observable, filtering out null/undefined Observables.
 *
 * @returns
 */
export function switchMapMaybeObs<T = unknown>(): OperatorFunction<Maybe<Observable<Maybe<T>>>, T> {
  return (source: Observable<Maybe<Observable<Maybe<T>>>>) => {
    const subscriber: Observable<T> = source.pipe(
      filterMaybe(),
      switchMap((x) => x)
    ) as Observable<T>;

    return subscriber;
  };
}

/**
 * Performs the input map function on the input if it is not null/undefined.
 *
 * @param mapFn
 * @returns
 */
export function mapMaybe<A, B>(mapFn: MapFunction<A, Maybe<B>>): OperatorFunction<Maybe<A>, Maybe<B>> {
  return mapIf(mapFn as MapFunction<Maybe<A>, Maybe<B>>, isMaybeSo);
}

/**
 * Performs the input map function on the input if the decision returns true.
 *
 * @param mapFn
 * @returns
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
export function emitDelayObs<T>(startWith: T, endWith: T, delayTime: Maybe<number>): Observable<T> {
  let obs = of(startWith);

  if (delayTime) {
    obs = obs.pipe(emitAfterDelay(endWith, delayTime));
  }

  return obs;
}

/**
 * Emits a value after a given delay after every new emission.
 */
export function emitAfterDelay<T>(value: T, delayTime: number): MonoTypeOperatorFunction<T> {
  return (obs: Observable<T>) => obs.pipe(switchMap((x) => of(value).pipe(delay(delayTime), startWith(x))));
}
