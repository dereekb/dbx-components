import { filterMaybe, FilterMapKey, FilterMap, MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { Directive, OnDestroy, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, delay, distinctUntilChanged } from 'rxjs';

/**
 * Provides a FilterSource from a parent FilterMap.
 */
@Directive()
export abstract class AbstractDbxFilterMapInstanceDirective<F> implements OnDestroy {
  readonly dbxFilterMap = inject(FilterMap<F>);
  private readonly _currentFilterMapKey = new BehaviorSubject<MaybeObservableOrValue<FilterMapKey>>(undefined);

  readonly filterMapKey$ = this._currentFilterMapKey.pipe(maybeValueFromObservableOrValue(), filterMaybe(), delay(0), distinctUntilChanged());
  readonly instance$ = this.dbxFilterMap.instanceObsForKeyObs(this.filterMapKey$);

  ngOnDestroy(): void {
    this._currentFilterMapKey.complete();
  }

  setFilterMapKey(filterMapKey: MaybeObservableOrValue<FilterMapKey>) {
    this._currentFilterMapKey.next(filterMapKey);
  }
}
