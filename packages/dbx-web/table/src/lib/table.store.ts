import { Injectable } from '@angular/core';
import { asObservable, beginLoading, filterMaybe, LoadingState, mapLoadingStateValueWithOperator, PageListLoadingState, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { spaceSeparatedCssClasses, type Maybe } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, distinctUntilChanged, first, map, shareReplay, switchMap, tap, combineLatest, of } from 'rxjs';
import { DbxTableColumn, DbxTableContextData, DbxTableContextDataDelegate, DbxTableItemGroup, DbxTableViewDelegate, defaultDbxTableItemGroup } from './table';

export interface DbxTableStoreState<I, C, T, G> {
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
  readonly viewDelegate: Maybe<DbxTableViewDelegate<I, C, T, G>>;
}

@Injectable()
export class DbxTableStore<I = unknown, C = unknown, T = unknown, G = unknown> extends ComponentStore<DbxTableStoreState<I, C, T, G>> {
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
  readonly tableCssClasses$ = this.viewDelegate$.pipe(map((x) => x.tableClasses));
  readonly spaceSeparatedTableCssClasses$ = this.tableCssClasses$.pipe(
    map((x) => spaceSeparatedCssClasses(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

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
    valueFromFinishedLoadingState(),
    filterMaybe(),
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

  readonly items$: Observable<T[]> = this.itemsState$.pipe(valueFromFinishedLoadingState(), filterMaybe(), shareReplay(1));

  readonly groupsState$: Observable<LoadingState<DbxTableItemGroup<T, G>[]>> = this.itemsState$.pipe(
    mapLoadingStateValueWithOperator(
      switchMap((x) => {
        return this.viewDelegate$.pipe(
          switchMap((viewDelegate) => {
            let groups: Observable<DbxTableItemGroup<T, G>[]>;

            if (viewDelegate.groupBy) {
              groups = asObservable(viewDelegate.groupBy(x));
            } else {
              groups = of([defaultDbxTableItemGroup<T, G>(x)]);
            }

            return groups;
          })
        );
      })
    ),
    shareReplay(1)
  );

  readonly groups$: Observable<DbxTableItemGroup<T, G>[]> = this.groupsState$.pipe(valueFromFinishedLoadingState(), filterMaybe(), shareReplay(1));

  // MARK: State Changes
  readonly setInput = this.updater((state, input: Maybe<I>) => ({ ...state, input }));
  readonly setDataDelegate = this.updater((state, dataDelegate: Maybe<DbxTableContextDataDelegate<I, C, T>>) => ({ ...state, dataDelegate }));
  readonly setViewDelegate = this.updater((state, viewDelegate: Maybe<DbxTableViewDelegate<I, C, T, G>>) => ({ ...state, viewDelegate }));
}
