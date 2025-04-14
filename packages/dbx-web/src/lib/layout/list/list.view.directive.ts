import { ListLoadingStateContext, MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { BehaviorSubject, distinctUntilChanged, map, Observable, shareReplay } from 'rxjs';
import { Directive, effect, input, OnDestroy, output, TrackByFunction } from '@angular/core';
import { DbxListSelectionMode, DbxListView } from './list.view';
import { type Maybe } from '@dereekb/util';

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
  private readonly _values = new BehaviorSubject<MaybeObservableOrValue<T[]>>(undefined);

  protected readonly _valuesArrayEffect = effect(() => this._values.next(this.valuesArray()), { allowSignalWrites: true });
  protected readonly _valuesEffect = effect(() => this._values.next(this.values()), { allowSignalWrites: true });

  readonly trackBy$ = this._trackBy.asObservable();
  readonly values$: Observable<T[]> = this._values.pipe(
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
    this._values.complete();
  }

  onClickValue(value: T) {
    this.clickValue.emit(value);
  }

  setListContext(state: ListLoadingStateContext<T>): void {
    this.setValues(state.list$);
  }

  setValues(valuesObs: MaybeObservableOrValue<T[]>): void {
    this._values.next(valuesObs);
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
