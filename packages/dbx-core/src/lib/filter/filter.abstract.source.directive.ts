import { of, Observable } from 'rxjs';
import { Directive, forwardRef, OnDestroy, OnInit, Provider, Type } from '@angular/core';
import { FilterSource, FilterSourceInstance, ObservableOrValue } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { provideFilterSource } from './filter.content';

export abstract class FilterSourceDirective<F = unknown> implements FilterSource<F> {
  abstract filter$: Observable<F>;
  abstract initWithFilter(filterObs: Observable<F>): void;
  abstract setFilter(filter: F): void;
  abstract resetFilter(): void;
}

/**
 * Angular provider convenience function for a FilterSourceDirective.
 */
export function provideFilterSourceDirective<S extends FilterSourceDirective<F>, F = unknown>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: FilterSourceDirective,
      useExisting: forwardRef(() => sourceType)
    },
    ...provideFilterSource(sourceType)
  ];
}

/**
 * Abstract FilterSource implementation and directive.
 */
@Directive()
export abstract class AbstractFilterSourceDirective<F = unknown> implements FilterSourceDirective<F>, OnInit, OnDestroy {
  protected defaultFilterValue?: Maybe<F>;

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
    return of(this.defaultFilterValue);
  }
}
