import { switchMap, mergeMap, map, withLatestFrom, shareReplay } from 'rxjs/operators';
import { Directive, Host, Input, OnInit } from '@angular/core';
import { ActionContextStoreSourceInstance } from './action.store.source';
import { BehaviorSubject, Observable, of, EMPTY } from 'rxjs';
import { OnDestroy } from '@angular/core';
import { hasValueOrNotEmpty, Maybe } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/util-rxjs';

export type DbNgxActionAutoTriggerIsModifiedFn<T> = (value: T) => Observable<boolean>;

/**
 * Directive that watches an observable for changes and sets the new value and modified states as necessary.
 */
@Directive({
  selector: '[dbxActionAutoTriggerValue]',
})
export class DbNgxActionAutoTriggerValueDirective<T, O> implements OnInit, OnDestroy {

  private _valueObs = new BehaviorSubject<Observable<T>>(EMPTY);
  private _isModifiedFn = new BehaviorSubject<Maybe<DbNgxActionAutoTriggerIsModifiedFn<T>>>(undefined);

  private _modifiedSub = new SubscriptionObject();
  private _triggerSub = new SubscriptionObject();

  @Input('dbxActionAutoTriggerValue')
  set dbxActionAutoTriggerValue(dbxActionAutoTriggerValue: Observable<T>) {
    this._valueObs.next(dbxActionAutoTriggerValue);
  }

  @Input()
  set dbxActionAutoTriggerModifiedNonEmptyValue(requireNonEmpty: boolean) {
    if (requireNonEmpty) {
      this.dbxActionAutoTriggerModified = (value) => {
        return of(hasValueOrNotEmpty(value));
      };
    }
  }

  @Input()
  set dbxActionAutoTriggerModified(dbxActionAutoTriggerModified: DbNgxActionAutoTriggerIsModifiedFn<T>) {
    this._isModifiedFn.next(dbxActionAutoTriggerModified);
  }

  readonly modifiedValue$ = this._valueObs.pipe(
    switchMap((obs) => obs.pipe(
      withLatestFrom(this._isModifiedFn),
      mergeMap(([value, dbxActionAutoTriggerModified]) => {
        let result: Observable<[boolean, T]>;

        if (dbxActionAutoTriggerModified) {
          result = dbxActionAutoTriggerModified(value).pipe(
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

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance<T, O>) { }

  ngOnInit(): void {
    // Update Modified value.
    this._modifiedSub.subscription = this.modifiedValue$.subscribe(([isModified, value]) => {
      this.source.setIsModified(isModified);
    });

    // Set the value on triggers.
    this._triggerSub.subscription = this.source.triggered$.pipe(
      mergeMap(x => this.modifiedValue$)
    ).subscribe(([isModified, value]) => {
      this.source.readyValue(value);
    });
  }

  ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      this._isModifiedFn.complete();
      this._valueObs.complete();
      this._modifiedSub.destroy();
      this._triggerSub.destroy();
    });
  }

}
