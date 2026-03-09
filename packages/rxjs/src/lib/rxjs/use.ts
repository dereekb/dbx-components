import { first, type Observable } from 'rxjs';

/**
 * Subscribes to the observable, calls the provided function with the first emitted value,
 * then automatically unsubscribes.
 *
 * @param obs - the source observable
 * @param useFn - function to call with the first value
 */
export function useFirst<T>(obs: Observable<T>, useFn: (value: T) => void) {
  obs.pipe(first()).subscribe(useFn);
}
