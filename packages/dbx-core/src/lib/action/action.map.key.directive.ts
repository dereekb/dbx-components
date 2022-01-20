import { filterMaybe } from '@dereekb/rxjs';
import { Directive, Input, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ActionKey } from './action.map';
import { ProvideSecondaryActionStoreSource, SecondaryActionContextStoreSource } from './action.store.source';
import { DbNgxActionContextMapDirective } from './action.map.directive';

/**
 * Directive that provides a ActionContextStoreSource using the input key and DbNgxActionContextMapDirective.
 */
@Directive({
  selector: '[dbxActionFromMap]',
  providers: ProvideSecondaryActionStoreSource(DbNgxActionFromMapDirective)
})
export class DbNgxActionFromMapDirective implements SecondaryActionContextStoreSource, OnDestroy {

  private _key = new BehaviorSubject<Maybe<ActionKey>>(undefined);
  readonly store$ = this._key.pipe(filterMaybe(), switchMap((x) => this._map.sourceForKey(x).store$));

  constructor(private readonly _map: DbNgxActionContextMapDirective) { }

  ngOnDestroy(): void {
    this._key.complete();
  }

  @Input('dbxActionFromMap')
  get key(): Maybe<ActionKey> {
    return this._key.value;
  }

  set key(key: Maybe<ActionKey>) {
    this._key.next(key);
  }

}
