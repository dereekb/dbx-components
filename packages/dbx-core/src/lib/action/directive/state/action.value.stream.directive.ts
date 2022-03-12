import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { switchMap, mergeMap, map, withLatestFrom, shareReplay } from 'rxjs/operators';
import { Directive, Host, Input, OnInit } from '@angular/core';
import { BehaviorSubject, Observable, of, EMPTY } from 'rxjs';
import { OnDestroy } from '@angular/core';
import { hasValueOrNotEmpty, Maybe, isDefinedAndNotFalse } from '@dereekb/util';
import { IsModifiedFn, SubscriptionObject } from '@dereekb/rxjs';

/**
 * Directive that watches a value observable for changes and sets the new value and modified states as necessary.
 */
@Directive({
  selector: '[dbxActionStreamValue]',
})
export class dbxActionStreamValueDirective<T, O> implements OnInit, OnDestroy {

  private _valueObs = new BehaviorSubject<Observable<T>>(EMPTY);
  private _isModifiedFn = new BehaviorSubject<Maybe<IsModifiedFn<T>>>(undefined);

  private _modifiedSub = new SubscriptionObject();
  private _triggerSub = new SubscriptionObject();

  @Input()
  set dbxActionStreamValue(dbxActionStreamValue: Observable<T>) {
    this._valueObs.next(dbxActionStreamValue);
  }

  @Input()
  set dbxActionStreamValueIsNotEmpty(requireNonEmpty: any) {
    if (isDefinedAndNotFalse(requireNonEmpty)) {
      this.dbxActionStreamValueModified = (value) => {
        return of(hasValueOrNotEmpty(value));
      };
    }
  }

  @Input()
  set dbxActionStreamValueModified(dbxActionStreamValueModified: IsModifiedFn<T>) {
    this._isModifiedFn.next(dbxActionStreamValueModified);
  }

  readonly modifiedValue$ = this._valueObs.pipe(
    switchMap((obs) => obs.pipe(
      withLatestFrom(this._isModifiedFn),
      mergeMap(([value, dbxActionStreamValueModified]) => {
        let result: Observable<[boolean, T]>;

        if (dbxActionStreamValueModified) {
          result = dbxActionStreamValueModified(value).pipe(
            map((isModified) => [isModified, value] as [boolean, T])
          );
        } else {
          result = of([true, value]);
        }

        return result;
      }),
      shareReplay(1)
    ))
  );

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>) { }

  ngOnInit(): void {
    // Update Modified value.
    this._modifiedSub.subscription = this.modifiedValue$.subscribe(([isModified, value]) => {
      this.source.setIsModified(isModified);
    });

    // Set the value on triggers.
    this._triggerSub.subscription = this.source.triggered$.pipe(
      switchMap(_ => this.modifiedValue$)
    ).subscribe(([isModified, value]) => {
      if (isModified) {
        this.source.readyValue(value);
      }
    });
  }

  ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      this._valueObs.complete();
      this._isModifiedFn.complete();
      this._modifiedSub.destroy();
      this._triggerSub.destroy();
    });
  }

}
