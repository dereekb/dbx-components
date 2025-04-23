import { filterMaybe } from '@dereekb/rxjs';
import { Directive, Input, OnDestroy, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, switchMap } from 'rxjs';
import { ActionContextStoreSourceMap, ActionKey } from './action.map';
import { SecondaryActionContextStoreSource } from '../../action.store.source';
import { provideSecondaryActionStoreSource } from '../../action.store.source.provide';

/**
 * Directive that provides a ActionContextStoreSource using the input key and DbxActionContextMapDirective.
 */
@Directive({
  selector: '[dbxActionFromMap]',
  providers: provideSecondaryActionStoreSource(DbxActionFromMapDirective),
  standalone: true
})
export class DbxActionFromMapDirective implements SecondaryActionContextStoreSource, OnDestroy {
  private readonly _actionContextStoreSourceMap = inject(ActionContextStoreSourceMap);
  private readonly _key = new BehaviorSubject<Maybe<ActionKey>>(undefined);

  readonly store$ = this._key.pipe(
    filterMaybe(),
    switchMap((x) => this._actionContextStoreSourceMap.sourceForKey(x).store$)
  );

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
