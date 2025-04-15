import { ListLoadingStateContext, MaybeObservableOrValue, asObservable, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { Directive, input, OnDestroy, output, TrackByFunction } from '@angular/core';
import { DbxListSelectionMode, DbxListView } from './list.view';
import { type Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Abstract DbxListView implementation.
 */
@Directive()
export abstract class AbstractDbxListViewDirective<T> implements DbxListView<T>, OnDestroy {
  readonly valuesArray = input<Maybe<T[]>>();
  readonly values = input<MaybeObservableOrValue<T[]>>();

  private readonly _trackBy = new BehaviorSubject<Maybe<TrackByFunction<T>>>(undefined);
  private readonly _disabled = new BehaviorSubject<boolean>(false);
  private readonly _selectionMode = new BehaviorSubject<Maybe<DbxListSelectionMode>>(undefined);
  private readonly _valuesOverride = new BehaviorSubject<MaybeObservableOrValue<T[]>>(undefined);

  readonly trackBy$ = this._trackBy.asObservable();

  readonly _inputValuesArray$ = toObservable(this.valuesArray);
  readonly _inputValues$ = toObservable(this.values);

  readonly _values$: Observable<Maybe<T[]>> = this._valuesOverride.pipe(
    switchMap((x) => {
      let valuesObs: Observable<Maybe<T[]>>;

      if (x) {
        valuesObs = asObservable(x);
      } else {
        valuesObs = combineLatest([this._inputValues$, this._inputValuesArray$]).pipe(switchMap(([x, y]) => (y != null ? of(y) : asObservable(x))));
      }

      return valuesObs;
    })
  );

  readonly values$: Observable<T[]> = this._values$.pipe(
    maybeValueFromObservableOrValue(),
    map((x) => x ?? []),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly disabled$ = this._disabled.asObservable();
  readonly selectionMode$ = this._selectionMode.asObservable();

  readonly clickValue = output<T>();

  ngOnDestroy(): void {
    this._disabled.complete();
    this._selectionMode.complete();
    this._valuesOverride.complete();
  }

  onClickValue(value: T) {
    this.clickValue.emit(value);
  }

  setListContext(state: ListLoadingStateContext<T>): void {
    this.setValues(state.currentList$);
  }

  setValues(values: MaybeObservableOrValue<T[]>): void {
    this._valuesOverride.next(values);
  }

  setDisabled(disabled: boolean): void {
    this._disabled.next(disabled);
  }

  setSelectionMode(selectionMode: Maybe<DbxListSelectionMode>): void {
    this._selectionMode.next(selectionMode);
  }

  setTrackBy(trackBy: Maybe<TrackByFunction<T>>) {
    this._trackBy.next(trackBy);
  }
}
