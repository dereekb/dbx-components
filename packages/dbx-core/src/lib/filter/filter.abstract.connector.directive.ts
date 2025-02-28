import { Observable, BehaviorSubject, of, switchMap, shareReplay } from 'rxjs';
import { Directive, OnDestroy } from '@angular/core';
import { FilterSourceConnector, FilterSource, filterMaybe } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';

/**
 * Abstract FilterSourceConnector directive.
 */
@Directive()
export abstract class AbstractFilterSourceConnectorDirective<F> implements FilterSourceConnector<F>, FilterSource<F>, OnDestroy {
  private _source = new BehaviorSubject<Maybe<FilterSource<F>>>(undefined);

  readonly filter$: Observable<F> = this._source.pipe(
    switchMap((x) => x?.filter$ ?? of(undefined)),
    filterMaybe(),
    shareReplay(1)
  );

  ngOnDestroy(): void {
    this._source.complete();
  }

  connectWithSource(filterSource: FilterSource<F>): void {
    this._source.next(filterSource);
  }
}
