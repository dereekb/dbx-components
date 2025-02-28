import { ListLoadingStateContext, switchMapMaybeObs } from '@dereekb/rxjs';
import { BehaviorSubject, Observable, of, shareReplay } from 'rxjs';
import { Directive, EventEmitter, Input, OnDestroy, Output, TrackByFunction } from '@angular/core';
import { DbxListSelectionMode, DbxListView } from './list.view';
import { type Maybe } from '@dereekb/util';

/**
 * Abstract DbxListView implementation.
 */
@Directive()
export abstract class AbstractDbxListViewDirective<T> implements DbxListView<T>, OnDestroy {
  private readonly _disabled = new BehaviorSubject<boolean>(false);
  private readonly _selectionMode = new BehaviorSubject<Maybe<DbxListSelectionMode>>(undefined);
  private readonly _values$ = new BehaviorSubject<Maybe<Observable<T[]>>>(undefined);

  readonly trackBy?: TrackByFunction<T> | undefined;

  readonly values$ = this._values$.pipe(switchMapMaybeObs(), shareReplay(1));
  readonly disabled$ = this._disabled.asObservable();
  readonly selectionMode$ = this._selectionMode.asObservable();

  @Output()
  readonly clickValue = new EventEmitter<T>();

  @Input()
  set valueArray(values: Maybe<T[]>) {
    this.setValues(values ? of(values) : undefined);
  }

  @Input()
  set values(values: Maybe<Observable<T[]>>) {
    this.setValues(values);
  }

  ngOnDestroy(): void {
    this._disabled.complete();
    this._selectionMode.complete();
    this._values$.complete();
  }

  onClickValue(value: T) {
    this.clickValue.emit(value);
  }

  setListContext(state: ListLoadingStateContext<T>): void {
    this.setValues(state.list$);
  }

  setValues(valuesObs: Maybe<Observable<T[]>>): void {
    this._values$.next(valuesObs);
  }

  setDisabled(disabled: boolean): void {
    this._disabled.next(disabled);
  }

  setSelectionMode(selectionMode: Maybe<DbxListSelectionMode>): void {
    this._selectionMode.next(selectionMode);
  }
}
