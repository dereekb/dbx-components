import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { switchMap, mergeMap, map, withLatestFrom, shareReplay, BehaviorSubject, Observable, of, EMPTY } from 'rxjs';
import { Directive, Host, Input, OnInit, OnDestroy } from '@angular/core';
import { hasValueOrNotEmpty, Maybe, isDefinedAndNotFalse } from '@dereekb/util';
import { IsModifiedFunction, SubscriptionObject } from '@dereekb/rxjs';

/**
 * Directive that watches a value observable for changes and sets the new value and modified states as necessary.
 */
@Directive({
  selector: '[dbxActionValueStream]',
})
export class dbxActionValueStreamDirective<T, O> implements OnInit, OnDestroy {

  private _valueObs = new BehaviorSubject<Observable<T>>(EMPTY);
  private _isModifiedFn = new BehaviorSubject<Maybe<IsModifiedFunction<T>>>(undefined);

  private _modifiedSub = new SubscriptionObject();
  private _triggerSub = new SubscriptionObject();

  @Input()
  set dbxActionValueStream(dbxActionValueStream: Observable<T>) {
    this._valueObs.next(dbxActionValueStream);
  }

  @Input()
  set dbxActionValueStreamIsNotEmpty(requireNonEmpty: unknown) {
    if (isDefinedAndNotFalse(requireNonEmpty)) {
      this.dbxActionValueStreamModified = (value) => {
        return of(hasValueOrNotEmpty(value));
      };
    }
  }

  @Input()
  set dbxActionValueStreamModified(dbxActionValueStreamModified: IsModifiedFunction<T>) {
    this._isModifiedFn.next(dbxActionValueStreamModified);
  }

  readonly modifiedValue$ = this._valueObs.pipe(
    switchMap((obs) => obs.pipe(
      withLatestFrom(this._isModifiedFn),
      mergeMap(([value, dbxActionValueStreamModified]) => {
        let result: Observable<[boolean, T]>;

        if (dbxActionValueStreamModified) {
          result = dbxActionValueStreamModified(value).pipe(
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
    this._modifiedSub.subscription = this.modifiedValue$.subscribe(([isModified]) => {
      this.source.setIsModified(isModified);
    });

    // Set the value on triggers.
    this._triggerSub.subscription = this.source.triggered$.pipe(
      switchMap(() => this.modifiedValue$)
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
