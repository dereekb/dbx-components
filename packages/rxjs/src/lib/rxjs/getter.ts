import { GetterOrValue, GetterOrValueWithInput, FactoryWithRequiredInput, Maybe, getValueFromGetter, GetterDistinctValue } from '@dereekb/util';
import { Observable, OperatorFunction, switchMap, of, isObservable, Subscription, Observer } from 'rxjs';

/**
 * A value that is either the value or an observable that returns the value.
 */
export type ObservableOrValue<T> = T | Observable<T>;

/**
 * Wraps the input value as an observable, if it is not an observable.
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
 * Switch map for an ObservableGetter that pipes through the value.
 *
 * @returns
 */
export function valueFromObservableOrValue<T>(): OperatorFunction<ObservableOrValue<T>, T> {
  return switchMap((x) => asObservable(x));
}

/**
 * A GetterOrValue of a ObservableOrValue.
 */
export type ObservableOrValueGetter<T> = GetterOrValue<ObservableOrValue<T>>;
export type ObservableOrValueFactoryWithInput<T extends GetterDistinctValue, A> = GetterOrValueWithInput<ObservableOrValue<T>, A>;
export type ObservableFactoryWithRequiredInput<T extends GetterDistinctValue, A> = FactoryWithRequiredInput<ObservableOrValue<T>, A>;
export type MaybeObservableOrValueGetter<T> = Maybe<ObservableOrValueGetter<Maybe<T>>>;

export function asObservableFromGetter<T>(input: ObservableOrValueGetter<T>): Observable<T>;
export function asObservableFromGetter<T>(this: unknown, input: ObservableOrValueGetter<T>): Observable<T>;
export function asObservableFromGetter<T extends GetterDistinctValue, A>(this: unknown, input: ObservableFactoryWithRequiredInput<T, A>, args: A): Observable<T>;
export function asObservableFromGetter<T extends GetterDistinctValue, A>(this: unknown, input: ObservableOrValueFactoryWithInput<T, A>, args?: A): Observable<T>;
export function asObservableFromGetter<T, A>(this: unknown, input: ObservableOrValueGetter<T>, args?: A): Observable<T> {
  const obs = getValueFromGetter<any, any>(input, args);
  return asObservable(obs);
}

/**
 * Switch map for an ObservableOrValueGetter that pipes through the value.
 *
 * @returns
 */
export function valueFromObservableOrValueGetter<T>(): OperatorFunction<ObservableOrValueGetter<T>, T> {
  return switchMap((x) => asObservableFromGetter(x));
}

export function maybeValueFromObservableOrValueGetter<T>(): OperatorFunction<MaybeObservableOrValueGetter<T>, Maybe<T>> {
  return switchMap((x) => (x != null ? asObservableFromGetter(x) : of(undefined)));
}

/**
 * Convenience function for subscribing to a ObservableOrValue<T> value as an observable.
 *
 * @param input
 * @param next
 */
export function useAsObservable<T>(input: ObservableOrValue<T>, next: (value: T) => void): Subscription;
export function useAsObservable<T>(input: ObservableOrValue<T>, observer: Partial<Observer<T>>): Subscription;
export function useAsObservable<T>(input: ObservableOrValue<T>, observer: ((value: T) => void) | Partial<Observer<T>>): Subscription;
export function useAsObservable<T>(input: ObservableOrValue<T>, observer: ((value: T) => void) | Partial<Observer<T>>): Subscription {
  return asObservable(input).subscribe(observer as Partial<Observer<T>>);
}
