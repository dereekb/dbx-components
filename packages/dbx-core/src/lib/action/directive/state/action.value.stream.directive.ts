import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { switchMap, mergeMap, map, withLatestFrom, shareReplay, Observable, of, EMPTY } from 'rxjs';
import { Directive, OnInit, OnDestroy, inject, input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { IsEqualFunction, IsModifiedFunction, makeIsModifiedFunctionObservable, SubscriptionObject } from '@dereekb/rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Directive that watches a value observable for changes and sets the new value and modified states as necessary.
 */
@Directive({
  selector: '[dbxActionValueStream]',
  standalone: true
})
export class DbxActionValueStreamDirective<T, O> implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly dbxActionValueStream = input<Observable<T>>(EMPTY);
  readonly dbxActionValueStreamIsEqualValue = input<Maybe<IsEqualFunction<T>>>();
  readonly dbxActionValueStreamIsModifiedValue = input<Maybe<IsModifiedFunction<T>>>();

  private readonly _modifiedSub = new SubscriptionObject();
  private readonly _triggerSub = new SubscriptionObject();

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

  ngOnInit(): void {
    // Update isModified on source
    this._modifiedSub.subscription = this.modifiedValue$.subscribe(([isModified]) => {
      this.source.setIsModified(isModified);
    });

    // Set the value on triggers.
    this._triggerSub.subscription = this.source.triggered$.pipe(switchMap(() => this.modifiedValue$)).subscribe(([isModified, value]) => {
      // only mark ready once modified
      if (isModified) {
        this.source.readyValue(value);
      }
    });
  }

  ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      this._modifiedSub.destroy();
      this._triggerSub.destroy();
    });
  }
}
