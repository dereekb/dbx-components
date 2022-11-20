import { filterMaybe } from '@dereekb/rxjs';
import { Directive, Input, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject, switchMap } from 'rxjs';
import { ActionKey } from './action.map';
import { SecondaryActionContextStoreSource } from '../../action.store.source';
import { DbxActionContextMapDirective } from './action.map.directive';
import { provideSecondaryActionStoreSource } from '../../action.store.source.provide';

/**
 * Directive that provides a ActionContextStoreSource using the input key and DbxActionContextMapDirective.
 */
@Directive({
  selector: '[dbxActionFromMap]',
  providers: provideSecondaryActionStoreSource(DbxActionFromMapDirective)
})
export class DbxActionFromMapDirective implements SecondaryActionContextStoreSource, OnDestroy {
  private _key = new BehaviorSubject<Maybe<ActionKey>>(undefined);
  readonly store$ = this._key.pipe(
    filterMaybe(),
    switchMap((x) => this._map.sourceForKey(x).store$)
  );

  constructor(private readonly _map: DbxActionContextMapDirective) {}

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
