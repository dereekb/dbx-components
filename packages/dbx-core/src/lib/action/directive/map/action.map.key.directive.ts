import { filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { switchMap } from 'rxjs';
import { ActionContextStoreSourceMap, ActionKey } from './action.map';
import { SecondaryActionContextStoreSource } from '../../action.store.source';
import { provideSecondaryActionStoreSource } from '../../action.store.source.provide';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Directive that provides a ActionContextStoreSource using the input key and DbxActionContextMapDirective.
 */
@Directive({
  selector: '[dbxActionFromMap]',
  providers: provideSecondaryActionStoreSource(DbxActionFromMapDirective),
  standalone: true
})
export class DbxActionFromMapDirective implements SecondaryActionContextStoreSource {
  private readonly _actionContextStoreSourceMap = inject(ActionContextStoreSourceMap);

  readonly key = input<Maybe<ActionKey>>(undefined, { alias: 'dbxActionFromMap' });
  readonly key$ = toObservable(this.key);

  readonly store$ = this.key$.pipe(
    filterMaybe(),
    switchMap((x) => this._actionContextStoreSourceMap.sourceForKey(x).store$)
  );
}
