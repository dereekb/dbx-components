import { of, Observable } from 'rxjs';
import { Directive, forwardRef, inject, InjectionToken, OnDestroy, OnInit, Provider, Type } from '@angular/core';
import { FilterSource, FilterSourceInstance, ObservableOrValue } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { provideFilterSource } from './filter.content';

export const FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_TOKEN = new InjectionToken<Maybe<Observable<Maybe<unknown>>>>('FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_SOURCE_TOKEN');

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
export abstract class AbstractFilterSourceDirective<F = unknown> implements FilterSourceDirective<F>, OnDestroy {
  private readonly _defaultFilter = inject<Maybe<Observable<Maybe<F>>>>(FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_TOKEN, { optional: true });

  protected readonly _defaultFilterSource = new FilterSourceInstance<F>({
    defaultFilter: this._defaultFilter
  });

  readonly filter$: Observable<F> = this._defaultFilterSource.filter$;

  ngOnDestroy(): void {
    this._defaultFilterSource.destroy();
  }

  protected setDefaultFilter(defaultFilter: Observable<Maybe<F>>): void {
    this._defaultFilterSource.setDefaultFilter(defaultFilter);
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

  get initialFilterTakesPriority() {
    return this._defaultFilterSource.initialFilterTakesPriority;
  }

  set initialFilterTakesPriority(initialFilterTakesPriority: boolean) {
    this._defaultFilterSource.initialFilterTakesPriority = initialFilterTakesPriority;
  }
}
