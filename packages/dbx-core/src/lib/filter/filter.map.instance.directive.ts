import { filterMaybe, FilterMapKey, FilterMap } from '@dereekb/rxjs';
import { BehaviorSubject } from 'rxjs';
import { Directive, OnDestroy, inject, signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Provides a FilterSource from a parent FilterMap.
 */
@Directive()
export abstract class AbstractDbxFilterMapInstanceDirective<F> implements OnDestroy {
  readonly dbxFilterMap = inject(FilterMap<F>);
  private readonly _currentFilterMapKeySignal = signal<Maybe<FilterMapKey>>(undefined);

  readonly filterMapKey$ = toObservable(this._currentFilterMapKeySignal).pipe(filterMaybe());
  readonly instance$ = this.dbxFilterMap.instanceObsForKeyObs(this.filterMapKey$);

  ngOnDestroy(): void {
    this._currentFilterMapKeySignal.set(undefined);
  }

  setFilterMapKey(filterMapKey: Maybe<FilterMapKey>) {
    this._currentFilterMapKeySignal.set(filterMapKey);
  }

  // MARK: Compat
  /**
   * @deprecated use filterMapKey$ instead.
   */
  readonly key$ = this.filterMapKey$;
}
