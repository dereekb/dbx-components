import { ListLoadingStateContext, switchMapMaybeObs } from '@dereekb/rxjs';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Directive, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { shareReplay } from 'rxjs/operators';
import { DbxListView } from './list.view';
import { Maybe } from '@dereekb/util';

/**
 * Abstract DbxListView implementation.
 */
@Directive()
export abstract class AbstractDbxListViewDirective<T> implements DbxListView<T>, OnDestroy {

  private readonly _disabled = new BehaviorSubject<boolean>(false);
  private readonly _values$ = new BehaviorSubject<Maybe<Observable<T[]>>>(undefined);

  readonly values$ = this._values$.pipe(switchMapMaybeObs(), shareReplay(1));
  readonly disabled$ = this._disabled.asObservable();

  @Output()
  clickValue = new EventEmitter<T>();

  constructor() { }

  @Input()
  set valueArray(values: Maybe<T[]>) {
    this.setValues(values ? of(values) : undefined);
  }

  @Input()
  set values(values: Maybe<Observable<T[]>>) {
    this.setValues(values);
  }

  ngOnDestroy(): void {
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

}
