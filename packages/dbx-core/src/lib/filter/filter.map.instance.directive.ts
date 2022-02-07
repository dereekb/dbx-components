import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject } from 'rxjs';
import { Directive, OnDestroy } from '@angular/core';
import { FilterMapKey, FilterMap } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

/**
 * Provides a FilterSource from a parent FilterMap.
 */
@Directive()
export abstract class AbstractDbxFilterMapInstanceDirective<F> implements OnDestroy {

  protected _key = new BehaviorSubject<Maybe<FilterMapKey>>(undefined);
  readonly key$ = this._key.pipe(filterMaybe());

  readonly instance$ = this.dbxFilterMap.instanceObsForKeyObs(this.key$);

  constructor(readonly dbxFilterMap: FilterMap<F>) { }

  ngOnDestroy(): void {
    this._key.complete();
  }

}
