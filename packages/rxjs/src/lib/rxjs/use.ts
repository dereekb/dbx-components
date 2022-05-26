import { first, Observable } from 'rxjs';

/**
 * Convenience function to subscribe to the input observable and use the first value.
 *
 * @param useFn
 */
export function useFirst<T>(obs: Observable<T>, useFn: (value: T) => void) {
  obs.pipe(first()).subscribe(useFn);
}
