import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { switchMap, mergeMap, map, withLatestFrom, shareReplay, Observable, of, EMPTY } from 'rxjs';
import { Directive, inject, input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { IsEqualFunction, IsModifiedFunction, makeIsModifiedFunctionObservable } from '@dereekb/rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { cleanSubscriptionWithLockSet } from '../../../rxjs';

/**
 * Directive that watches a value observable for changes and sets the new value and modified states as necessary.
 */
@Directive({
  selector: '[dbxActionValueStream]',
  standalone: true
})
export class DbxActionValueStreamDirective<T, O> {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly dbxActionValueStream = input<Observable<T>>(EMPTY);
  readonly dbxActionValueStreamIsEqualValue = input<Maybe<IsEqualFunction<T>>>();
  readonly dbxActionValueStreamIsModifiedValue = input<Maybe<IsModifiedFunction<T>>>();

  readonly isModifiedFunction$: Observable<IsModifiedFunction<T>> = makeIsModifiedFunctionObservable({
    isModified: toObservable(this.dbxActionValueStreamIsModifiedValue),
    isEqual: toObservable(this.dbxActionValueStreamIsEqualValue)
  }).pipe(shareReplay(1));

  readonly modifiedValue$ = toObservable(this.dbxActionValueStream).pipe(
    switchMap((obs) =>
      obs.pipe(
        withLatestFrom(this.isModifiedFunction$),
        mergeMap(([value, dbxActionValueStreamModified]) => {
          let result: Observable<[boolean, T]>;

          if (dbxActionValueStreamModified) {
            result = dbxActionValueStreamModified(value).pipe(map((isModified) => [isModified, value] as [boolean, T]));
          } else {
            result = of([true, value]);
          }

          return result;
        }),
        shareReplay(1)
      )
    )
  );

  constructor() {
    // Update isModified on source
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.modifiedValue$.subscribe(([isModified]) => {
        this.source.setIsModified(isModified);
      })
    });

    // Set the value on triggers.
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.source.triggered$.pipe(switchMap(() => this.modifiedValue$)).subscribe(([isModified, value]) => {
        // only mark ready once modified
        if (isModified) {
          this.source.readyValue(value);
        }
      })
    });
  }
}
