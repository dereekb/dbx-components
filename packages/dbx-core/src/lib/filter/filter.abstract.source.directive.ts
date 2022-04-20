import { of, Observable } from 'rxjs';
import { Directive, OnDestroy, OnInit } from '@angular/core';
import { FilterSource, FilterSourceInstance, ObservableOrValue } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

/**
 * Abstract FilterSource implementation.
 */
@Directive()
export abstract class AbstractFilterSourceDirective<F> implements FilterSource<F>, OnInit, OnDestroy {

  protected _defaultFilterSource = new FilterSourceInstance<F>();

  readonly filter$: Observable<F> = this._defaultFilterSource.filter$;

  ngOnInit(): void {
    this._defaultFilterSource.setDefaultFilter(this.makeDefaultFilter());
  }

  ngOnDestroy(): void {
    this._defaultFilterSource.destroy();
  }

  initWithFilter(filterObs: Observable<F>): void {
    this._defaultFilterSource.initWithFilter(filterObs);
  }

  setFilter(filter: F): void {
    this._defaultFilterSource.setFilter(filter);
  }

  resetFilter(): void {
    this._defaultFilterSource.resetFilter();
  }

  // MARK: Internal
  protected makeDefaultFilter(): ObservableOrValue<Maybe<F>> {
    return of(undefined);
  }

}
