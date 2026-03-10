import { filterMaybe, type FilterMapKey, FilterMap, type MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { Directive, type OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged } from 'rxjs';

/**
 * Abstract directive that resolves a specific filter instance from a parent {@link FilterMap} by key.
 *
 * Subclasses set the key via {@link setFilterMapKey} and access the resolved instance via `instance$`.
 *
 * @typeParam F - The filter type.
 */
@Directive()
export abstract class AbstractDbxFilterMapInstanceDirective<F> implements OnDestroy {
  readonly dbxFilterMap = inject(FilterMap<F>);
  private readonly _currentFilterMapKey = new BehaviorSubject<MaybeObservableOrValue<FilterMapKey>>(undefined);

  readonly filterMapKey$ = this._currentFilterMapKey.pipe(maybeValueFromObservableOrValue(), filterMaybe(), distinctUntilChanged());
  readonly instance$ = this.dbxFilterMap.instanceObsForKeyObs(this.filterMapKey$);

  ngOnDestroy(): void {
    this._currentFilterMapKey.complete();
  }

  setFilterMapKey(filterMapKey: MaybeObservableOrValue<FilterMapKey>) {
    this._currentFilterMapKey.next(filterMapKey);
  }
}
