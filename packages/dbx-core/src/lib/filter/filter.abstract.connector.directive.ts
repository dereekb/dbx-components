import { type Observable, BehaviorSubject, of, switchMap, shareReplay } from 'rxjs';
import { Directive } from '@angular/core';
import { type FilterSourceConnector, type FilterSource, filterMaybe } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { completeOnDestroy } from '../rxjs';

/**
 * Abstract directive implementing both {@link FilterSourceConnector} and {@link FilterSource}.
 *
 * Receives a filter source via {@link connectWithSource} and re-emits its filter values.
 * Subclass to create concrete connector directives.
 *
 * @typeParam F - The filter type.
 *
 * @example
 * ```html
 * <div dbxFilterSourceConnector>
 *   <!-- Child components can inject FilterSource to read the connected filter -->
 * </div>
 * ```
 */
@Directive()
export abstract class AbstractFilterSourceConnectorDirective<F> implements FilterSourceConnector<F>, FilterSource<F> {
  private readonly _source = completeOnDestroy(new BehaviorSubject<Maybe<FilterSource<F>>>(undefined));

  readonly filter$: Observable<F> = this._source.pipe(
    switchMap((x) => x?.filter$ ?? of(undefined)),
    filterMaybe(),
    shareReplay(1)
  );

  connectWithSource(filterSource: FilterSource<F>): void {
    this._source.next(filterSource);
  }
}
