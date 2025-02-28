import { filterMaybe, FilterMapKey, FilterMap } from '@dereekb/rxjs';
import { BehaviorSubject } from 'rxjs';
import { Directive, OnDestroy, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Provides a FilterSource from a parent FilterMap.
 */
@Directive()
export abstract class AbstractDbxFilterMapInstanceDirective<F> implements OnDestroy {
  protected _key = new BehaviorSubject<Maybe<FilterMapKey>>(undefined);

  readonly dbxFilterMap = inject(FilterMap<F>);
  readonly key$ = this._key.pipe(filterMaybe());

  readonly instance$ = this.dbxFilterMap.instanceObsForKeyObs(this.key$);

  ngOnDestroy(): void {
    this._key.complete();
  }
}
