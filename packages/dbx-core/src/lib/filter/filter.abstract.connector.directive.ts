import { Observable, BehaviorSubject, of, switchMap, shareReplay } from 'rxjs';
import { Directive } from '@angular/core';
import { FilterSourceConnector, FilterSource, filterMaybe } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { completeOnDestroy } from '../rxjs';

/**
 * Abstract FilterSourceConnector directive.
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
