import { switchMap, mergeMap, map, withLatestFrom, shareReplay } from 'rxjs/operators';
import { Directive, Host, Input, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective, hasValueOrNotEmpty } from '../utility';
import { ActionContextStoreSourceInstance } from './action';
import { BehaviorSubject, Observable, of, EMPTY } from 'rxjs';
import { OnDestroy } from '@angular/core';
import { SubscriptionObject } from '../subscription';

export type DbNgxActionAutoTriggerIsModifiedFn<T> = (value: T) => Observable<boolean>;

/**
 * Directive that watches an observable for changes and sets the new value and modified states as necessary.
 */
@Directive({
  selector: '[dbxActionAutoTriggerValue]',
})
export class DbNgxActionAutoTriggerValueDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _valueObs = new BehaviorSubject<Observable<T>>(EMPTY);
  private _isModifiedFn = new BehaviorSubject<DbNgxActionAutoTriggerIsModifiedFn<T>>(undefined);
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

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    // Update Modified value.
    this.sub = this.modifiedValue$.subscribe(([isModified, value]) => {
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
      super.ngOnDestroy();
      this._isModifiedFn.complete();
      this._valueObs.complete();
      this._triggerSub.destroy();
    });
  }

}
