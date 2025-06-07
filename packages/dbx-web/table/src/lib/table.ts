import { Observable } from 'rxjs';
import { LoadingState, ObservableOrValue, PageListLoadingState } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { TrackByFunction } from '@angular/core';

/**
 * Delegate used for retrieving data for a table.
 */
export interface DbxTableContextDataDelegate<I, C, T> {
  /**
   * Loads data given the input.
   *
   * @param input
   */
  loadData(input: I): Observable<LoadingState<DbxTableContextData<I, C, T>>>;
}

export interface DbxTableContextData<I, C, T> {
  /**
   * Original context input
   */
  readonly input: I;
  /**
   * All columns in this data context.
   */
  readonly columns: DbxTableColumn<C>[];
  /**
   * All currently loaded items.
   */
  readonly items$: Observable<PageListLoadingState<T>>;
  /**
   * Loads more items, if applicable.
   */
  loadMore?(): void;
}

export interface DbxTableColumn<C> {
  /**
   * Unique column name
   */
  readonly columnName: string;
  /**
   * Column metadata
   */
  readonly meta: C;
}

export const NO_GROUPS_ID = 'none';

/**
 * Unique identifier used for grouping items together.
 */
export type DbxTableGroupId = string;

export interface DbxTableItemGroup<T, G = unknown> {
  readonly groupId: DbxTableGroupId;
  readonly items: T[];
  readonly meta: G;
}

export interface DefaultDbxTableItemGroup<T, G = unknown> extends DbxTableItemGroup<T, G> {
  readonly groupId: typeof NO_GROUPS_ID;
  readonly default: true;
}

export function defaultDbxTableItemGroup<T, G = unknown>(items: T[]): DefaultDbxTableItemGroup<T, G> {
  return {
    groupId: NO_GROUPS_ID,
    items,
    meta: undefined as G,
    default: true
  };
}

export type DbxTableGroupByFunction<T, G = unknown> = (items: T[]) => ObservableOrValue<DbxTableItemGroup<T, G>[]>;

/**
 * Delegate used for generating view configurations given the input.
 */
export interface DbxTableViewDelegate<I = unknown, C = unknown, T = unknown, G = unknown> {
  /**
   * Track by
   */
  readonly trackBy?: TrackByFunction<T>;
  /**
   * If provided, will group items together
   */
  readonly groupBy?: DbxTableGroupByFunction<T, G>;
  /**
   * Input picker view configuration
   */
  readonly inputHeader?: Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Action header view configuration
   */
  readonly actionHeader?: Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Summary row header view configuration
   */
  readonly summaryRowHeader?: Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Summary row end view configuration
   */
  readonly summaryRowEnd?: Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Group row header view configuration for a specific group.
   *
   * If this function returns undefined, the group row will not be shown.
   *
   * @param group
   */
  groupHeader?(group: DbxTableItemGroup<T, G>): Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Group row footer view configuration for a specific group.
   *
   * If this function returns undefined, the group row will not be shown.
   *
   * @param group
   */
  groupFooter?(group: DbxTableItemGroup<T, G>): Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Column header view configuration for a specific column.
   *
   * @param item
   */
  columnHeader?(column: DbxTableColumn<C>): Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Column footer view configuration for a specific column.
   *
   * @param item
   */
  columnFooter?(column: DbxTableColumn<C>): Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Item header view configuration for a specific item.
   *
   * @param item
   */
  itemHeader(item: T): Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Item cell view configuration for a specific item and column.
   *
   * @param item
   */
  itemCell(column: DbxTableColumn<C>, item: T): Maybe<DbxInjectionComponentConfig<any>>;
  /**
   * Item action view configuration for a specific item.
   *
   * @param item
   */
  itemAction?(item: T): Maybe<DbxInjectionComponentConfig<any>>;
}
