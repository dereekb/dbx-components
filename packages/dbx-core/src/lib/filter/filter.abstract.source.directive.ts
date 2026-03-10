import { type Observable } from 'rxjs';
import { Directive, forwardRef, inject, InjectionToken, Injector, type OnDestroy, type Provider, type Type } from '@angular/core';
import { type FilterSource, FilterSourceInstance, type MaybeObservableOrValue } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { provideFilterSource } from './filter.content';

/**
 * DI token for providing a default filter value to {@link AbstractFilterSourceDirective}.
 */
export const FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_TOKEN = new InjectionToken<Maybe<Observable<Maybe<unknown>>>>('FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_SOURCE_TOKEN');

/**
 * Abstract class defining the contract for a filter source directive that can be set, reset, and initialized with filters.
 *
 * @typeParam F - The filter type.
 */
export abstract class FilterSourceDirective<F = unknown> implements FilterSource<F> {
  abstract readonly filter$: Observable<F>;
  abstract initWithFilter(filterObs: Observable<F>): void;
  abstract setFilter(filter: F): void;
  abstract resetFilter(): void;
}

/**
 * Factory function type for creating a default filter value, given access to the Angular injector.
 *
 * @typeParam F - The filter type.
 */
export type ProvideFilterSourceDirectiveDefaultFilterFactoryFunction<F = unknown> = (injector: Injector) => MaybeObservableOrValue<F>;

/**
 * Creates Angular providers for a {@link FilterSourceDirective} implementation,
 * with an optional factory for providing a default filter value.
 *
 * @param sourceType - The concrete directive class.
 * @param defaultFilterFactory - Optional factory to provide an initial filter value via DI.
 *
 * @example
 * ```typescript
 * @Directive({
 *   selector: '[myFilterSource]',
 *   providers: provideFilterSourceDirective(MyFilterSourceDirective),
 * })
 * export class MyFilterSourceDirective extends AbstractFilterSourceDirective<MyFilter> {}
 * ```
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
 * Abstract directive providing a complete {@link FilterSource} implementation backed by a {@link FilterSourceInstance}.
 *
 * Supports setting/resetting filters, initializing from an external observable, and providing
 * a default filter via the {@link FILTER_SOURCE_DIRECTIVE_DEFAULT_FILTER_TOKEN} DI token.
 *
 * @typeParam F - The filter type.
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
    console.log('Setting default filter: ', defaultFilter);
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
}
