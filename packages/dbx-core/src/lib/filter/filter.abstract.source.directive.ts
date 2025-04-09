import { Observable } from 'rxjs';
import { Directive, forwardRef, inject, InjectionToken, Injector, OnDestroy, Provider, Type } from '@angular/core';
import { FilterSource, FilterSourceInstance, MaybeObservableOrValue } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { provideFilterSource } from './filter.content';

export const FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_TOKEN = new InjectionToken<Maybe<Observable<Maybe<unknown>>>>('FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_SOURCE_TOKEN');

export abstract class FilterSourceDirective<F = unknown> implements FilterSource<F> {
  abstract readonly filter$: Observable<F>;
  abstract initWithFilter(filterObs: Observable<F>): void;
  abstract setFilter(filter: F): void;
  abstract resetFilter(): void;
}

export type ProvideFilterSourceDirectiveDefaultFilterFactoryFunction<F = unknown> = (injector: Injector) => MaybeObservableOrValue<F>;

/**
 * Angular provider convenience function for a FilterSourceDirective.
 */
export function provideFilterSourceDirective<S extends FilterSourceDirective<F>, F = unknown>(sourceType: Type<S>, defaultFilterFactory?: ProvideFilterSourceDirectiveDefaultFilterFactoryFunction): Provider[] {
  const providers = [
    {
      provide: FilterSourceDirective,
      useExisting: forwardRef(() => sourceType)
    },
    ...provideFilterSource(sourceType)
  ];

  if (defaultFilterFactory != null) {
    providers.push({
      provide: FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_TOKEN,
      useFactory: defaultFilterFactory,
      deps: [Injector]
    });
  }

  return providers;
}

/**
 * Abstract FilterSource implementation and directive.
 */
@Directive()
export abstract class AbstractFilterSourceDirective<F = unknown> implements FilterSourceDirective<F>, OnDestroy {
  private readonly _defaultFilter = inject<MaybeObservableOrValue<F>>(FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_TOKEN, { optional: true });

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

  setInitialFilterTakesPriority(initialFilterTakesPriority: boolean) {
    this._defaultFilterSource.setInitialFilterTakesPriority(initialFilterTakesPriority);
  }

  // MARK: Deprecated
  /**
   * @deprecated use setInitialFilterTakesPriority() instead.
   */
  set initialFilterTakesPriority(initialFilterTakesPriority: boolean) {
    this.setInitialFilterTakesPriority(initialFilterTakesPriority);
  }
}
