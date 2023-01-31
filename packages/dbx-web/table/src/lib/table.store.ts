import { Injectable } from '@angular/core';
import { beginLoading, filterMaybe, LoadingState, PageListLoadingState, PageLoadingState, tapOnLoadingStateSuccess, valueFromLoadingState, tapLog } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, distinctUntilChanged, first, map, shareReplay, switchMap, tap, combineLatest, of, EMPTY } from 'rxjs';
import { DbxTableColumn, DbxTableContextData, DbxTableContextDataDelegate, DbxTableViewDelegate } from './table';

export interface DbxTableStoreState<I, C, T> {
  /**
   * Contextual input that is passed to the data delegate.
   */
  readonly input: Maybe<I>;
  /**
   * Delegate used for retrieving info given the selection.
   */
  readonly dataDelegate: Maybe<DbxTableContextDataDelegate<I, C, T>>;
  /**
   * Delegate used for retrieving view configurations.
   */
  readonly viewDelegate: Maybe<DbxTableViewDelegate<I, C, T>>;
}

@Injectable()
export class DbxTableStore<I = unknown, C = unknown, T = unknown> extends ComponentStore<DbxTableStoreState<I, C, T>> {
  constructor() {
    super({
      input: null,
      dataDelegate: null,
      viewDelegate: null
    });
  }

  // MARK: Effects
  readonly loadMore = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() =>
        this.data$.pipe(
          first(),
          tap((x) => {
            if (x.loadMore) {
              x.loadMore();
            }
          })
        )
      )
    );
  });

  // MARK: Accessors
  readonly input$ = this.state$.pipe(
    map((x) => x.input),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dataDelegate$ = this.state$.pipe(
    map((x) => x.dataDelegate),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentViewDelegate$ = this.state$.pipe(
    map((x) => x.viewDelegate),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly viewDelegate$ = this.currentViewDelegate$.pipe(filterMaybe());

  readonly dataState$: Observable<LoadingState<DbxTableContextData<I, C, T>>> = combineLatest([this.input$, this.dataDelegate$]).pipe(
    switchMap(([input, dataDelegate]) => {
      let obs: Observable<LoadingState<DbxTableContextData<I, C, T>>>;

      if (input && dataDelegate) {
        obs = dataDelegate.loadData(input);
      } else {
        obs = of(beginLoading<DbxTableContextData<I, C, T>>());
      }

      return obs;
    }),
    shareReplay(1)
  );

  readonly data$: Observable<DbxTableContextData<I, C, T>> = this.dataState$.pipe(
    //
    valueFromLoadingState(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly columns$: Observable<DbxTableColumn<C>[]> = this.data$.pipe(
    map((x) => x.columns),
    shareReplay(1)
  );

  readonly itemsState$: Observable<PageListLoadingState<T>> = this.data$.pipe(
    switchMap((x) => x.items$),
    shareReplay(1)
  );

  readonly items$: Observable<T[]> = this.itemsState$.pipe(valueFromLoadingState(), shareReplay(1));

  // MARK: State Changes
  readonly setInput = this.updater((state, input: Maybe<I>) => ({ ...state, input }));
  readonly setDataDelegate = this.updater((state, dataDelegate: Maybe<DbxTableContextDataDelegate<I, C, T>>) => ({ ...state, dataDelegate }));
  readonly setViewDelegate = this.updater((state, viewDelegate: Maybe<DbxTableViewDelegate<I, C, T>>) => ({ ...state, viewDelegate }));
}
