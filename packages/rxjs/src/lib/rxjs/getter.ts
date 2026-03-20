import { type GetterOrValue, type GetterOrValueWithInput, type FactoryWithRequiredInput, type Maybe, getValueFromGetter, type GetterDistinctValue } from '@dereekb/util';
import { type Observable, type OperatorFunction, switchMap, of, isObservable, type Subscription, type Observer } from 'rxjs';

/**
 * A value that is either the value or an observable that returns the value.
 */
export type ObservableOrValue<T> = T | Observable<T>;
export type MaybeObservableOrValue<T> = Maybe<ObservableOrValue<Maybe<T>>>;

/**
 * Wraps a value as an observable using `of()`, or returns it directly if it is already an observable.
 *
 * @param valueOrObs - the value or observable to wrap
 * @returns an observable that emits the given value, or the original observable if already one
 */
export function asObservable<T>(valueOrObs: ObservableOrValue<T>): Observable<T>;
export function asObservable<T>(valueOrObs: Maybe<ObservableOrValue<T>>): Observable<Maybe<T>>;
export function asObservable<T>(valueOrObs: Maybe<ObservableOrValue<T>>): Observable<Maybe<T>> {
  if (isObservable(valueOrObs)) {
    return valueOrObs;
  } else {
    return of(valueOrObs);
  }
}

/**
 * RxJS operator that flattens an emitted {@link ObservableOrValue} into its unwrapped value via `switchMap`.
 *
 * @returns an operator that unwraps ObservableOrValue emissions
 */
export function valueFromObservableOrValue<T>(): OperatorFunction<ObservableOrValue<T>, T> {
  return switchMap((x) => asObservable(x));
}

/**
 * RxJS operator that flattens an emitted Maybe<{@link ObservableOrValue}> into its unwrapped value,
 * emitting `undefined` when the input is nullish.
 *
 * @returns an operator that unwraps Maybe<ObservableOrValue> emissions
 */
export function maybeValueFromObservableOrValue<T>(): OperatorFunction<MaybeObservableOrValue<T>, Maybe<T>> {
  return switchMap((x) => (x != null ? asObservable(x) : of(undefined)));
}

/**
 * A GetterOrValue of a ObservableOrValue.
 */
export type ObservableOrValueGetter<T> = GetterOrValue<ObservableOrValue<T>>;
export type ObservableOrValueFactoryWithInput<T extends GetterDistinctValue, A> = GetterOrValueWithInput<ObservableOrValue<T>, A>;
export type ObservableFactoryWithRequiredInput<T extends GetterDistinctValue, A> = FactoryWithRequiredInput<ObservableOrValue<T>, A>;
export type MaybeObservableOrValueGetter<T> = Maybe<ObservableOrValueGetter<Maybe<T>>>;

/**
 * Resolves an {@link ObservableOrValueGetter} into an Observable by first evaluating the getter,
 * then wrapping the result with {@link asObservable} if needed.
 *
 * @param input - a getter or value that produces an observable or value
 * @param args - optional arguments passed to the getter
 * @returns an observable of the resolved value
 */
export function asObservableFromGetter<T>(input: ObservableOrValueGetter<T>): Observable<T>;
export function asObservableFromGetter<T>(this: unknown, input: ObservableOrValueGetter<T>): Observable<T>;
export function asObservableFromGetter<T extends GetterDistinctValue, A>(this: unknown, input: ObservableFactoryWithRequiredInput<T, A>, args: A): Observable<T>;
export function asObservableFromGetter<T extends GetterDistinctValue, A>(this: unknown, input: ObservableOrValueFactoryWithInput<T, A>, args?: A): Observable<T>;
export function asObservableFromGetter<T, A>(this: unknown, input: ObservableOrValueGetter<T>, args?: A): Observable<T> {
  const obs = getValueFromGetter<any, any>(input, args);
  return asObservable(obs);
}

/**
 * RxJS operator that flattens an emitted {@link ObservableOrValueGetter} into its resolved value via `switchMap`.
 *
 * @returns an operator that unwraps getter emissions
 */
export function valueFromObservableOrValueGetter<T>(): OperatorFunction<ObservableOrValueGetter<T>, T> {
  return switchMap((x) => asObservableFromGetter(x));
}

/**
 * RxJS operator that flattens an emitted Maybe<{@link ObservableOrValueGetter}> into its resolved value,
 * emitting `undefined` when the input is nullish.
 *
 * @returns an operator that unwraps Maybe<ObservableOrValueGetter> emissions, emitting undefined for nullish inputs
 */
export function maybeValueFromObservableOrValueGetter<T>(): OperatorFunction<MaybeObservableOrValueGetter<T>, Maybe<T>> {
  return switchMap((x) => (x != null ? asObservableFromGetter(x) : of(undefined)));
}

/**
 * Subscribes to an {@link ObservableOrValue} and calls the observer/next function with each emitted value.
 *
 * @param input - the observable or value to subscribe to
 * @param next - callback function or partial observer to handle each emitted value
 * @returns the resulting subscription
 */
export function useAsObservable<T>(input: ObservableOrValue<T>, next: (value: T) => void): Subscription;
export function useAsObservable<T>(input: ObservableOrValue<T>, observer: Partial<Observer<T>>): Subscription;
export function useAsObservable<T>(input: ObservableOrValue<T>, observer: ((value: T) => void) | Partial<Observer<T>>): Subscription;
export function useAsObservable<T>(input: ObservableOrValue<T>, observer: ((value: T) => void) | Partial<Observer<T>>): Subscription {
  return asObservable(input).subscribe(observer as Partial<Observer<T>>);
}
