import { Observable } from 'rxjs';
import { LoadingState, PageListLoadingState } from '@dereekb/rxjs';
import { ClassType, Maybe } from '@dereekb/util';
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

/**
 * Delegate used for generating view configurations given the input.
 */
export interface DbxTableViewDelegate<I = unknown, C = unknown, T = unknown> {
  /**
   * Track by
   */
  readonly trackBy?: TrackByFunction<T>;
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
