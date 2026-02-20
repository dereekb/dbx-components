import { ListLoadingStateContext, MaybeObservableOrValue, asObservable, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { combineLatest, distinctUntilChanged, map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { Directive, input, NgModule, output, signal, TrackByFunction } from '@angular/core';
import { DbxListSelectionMode, DbxListView } from './list.view';
import { type Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';
import { DbxValueListViewComponent } from './list.view.value.component';

export const DEFAULT_DBX_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE = '<dbx-list-view [config]="config"></dbx-list-view>';

@NgModule({
  exports: [DbxValueListViewComponent],
  imports: [DbxValueListViewComponent]
})
export class DbxValueListViewComponentImportsModule {}

// MARK: Value List View
/**
 * Abstract DbxListView implementation.
 *
 * You might consider extending AbstractDbxSelectionListViewDirective instead, as it includes selection support.
 */
@Directive()
export abstract class AbstractDbxListViewDirective<T> implements DbxListView<T> {
  readonly valuesArray = input<Maybe<T[]>>();
  readonly values = input<MaybeObservableOrValue<T[]>>();

  readonly clickValue = output<T>();

  private readonly _trackBySignal = signal<Maybe<TrackByFunction<T>>>(undefined);
  private readonly _disabledSignal = signal<boolean>(false);
  private readonly _selectionModeSignal = signal<Maybe<DbxListSelectionMode>>(undefined);
  private readonly _valuesOverrideSignal = signal<MaybeObservableOrValue<T[]>>(undefined);

  readonly trackBy$ = toObservable(this._trackBySignal);
  readonly disabled$ = toObservable(this._disabledSignal);
  readonly selectionMode$ = toObservable(this._selectionModeSignal);

  readonly _inputValuesArray$ = toObservable(this.valuesArray);
  readonly _inputValues$ = toObservable(this.values);

  readonly _values$: Observable<Maybe<T[]>> = toObservable(this._valuesOverrideSignal).pipe(
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

  onClickValue(value: T) {
    this.clickValue.emit(value);
  }

  setListContext(state: ListLoadingStateContext<T>): void {
    this.setValues(state.currentList$);
  }

  setValues(values: MaybeObservableOrValue<T[]>): void {
    this._valuesOverrideSignal.set(values);
  }

  setDisabled(disabled: boolean): void {
    this._disabledSignal.set(disabled);
  }

  setSelectionMode(selectionMode: Maybe<DbxListSelectionMode>): void {
    this._selectionModeSignal.set(selectionMode);
  }

  setTrackBy(trackBy: Maybe<TrackByFunction<T>>) {
    this._trackBySignal.set(trackBy);
  }
}
