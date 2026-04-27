import { Pipe, type PipeTransform } from '@angular/core';
import { asObservableFromGetter, type ObservableOrValueGetter } from '@dereekb/rxjs';
import { type Observable } from 'rxjs';

/**
 * Converts an {@link ObservableOrValueGetter} into an {@link Observable}.
 *
 * Useful for normalizing values that may be plain values, getter functions, or Observables
 * into a consistent Observable stream for use with the `async` pipe.
 *
 * @dbxPipe
 * @dbxPipeSlug as-observable
 * @dbxPipeCategory async
 * @example
 * ```html
 * <span>{{ valueOrGetter | asObservable | async }}</span>
 * ```
 */
@Pipe({
  name: 'asObservable',
  standalone: true
})
export class AsObservablePipe implements PipeTransform {
  transform<T>(input: ObservableOrValueGetter<T>): Observable<T> {
    return asObservableFromGetter(input);
  }
}
