import { combineLatest, map, Observable, of, shareReplay, startWith, switchMap } from 'rxjs';
import { PrimativeKey, Maybe, filterMaybeArrayValues, ReadRequiredKeyFunction } from '@dereekb/util';
import { DbxTableColumn } from './table';
import { DbxTableStore } from './table.store';

export interface DbxTableReaderCellPair<C, T> {
  readonly column: DbxTableColumn<C>;
  readonly item: T;
}

export interface DbxTableReaderCellDataPair<C, T, O> extends DbxTableReaderCellPair<C, T> {
  readonly value: O;
}

/**
 * Key used for tracking columns.
 *
 * Generally the table name is used for this.
 */
export type DbxTableReaderColumnKey = string;

/**
 * Key used for tracking items.
 *
 * Generally the item's unique identifier is used for this.
 */
export type DbxTableReaderItemKey = PrimativeKey;

/**
 * Default track by function for DbxTableColumn.
 *
 * Returns the column name.
 *
 * @param column
 * @returns
 */
export const DEFAULT_DBX_TABLE_READER_COLUMN_TRACK_BY: ReadRequiredKeyFunction<DbxTableColumn<DbxTableReaderColumnKey>> = (column) => column.columnName;

/**
 * Function used for tracking unique columns using the column's data.
 *
 * If the column key value is the same between those two columns, then the metadata of both columns will be considered the same/equal.
 */
export type DbxTableReaderColumnTrackByFunction<C> = ReadRequiredKeyFunction<DbxTableColumn<C>, DbxTableReaderColumnKey>;

/**
 * Function used for tracking unique columns using the column's data.
 *
 * If the column key value is the same between those two columns, then the metadata of both columns will be considered the same/equal.
 */
export type DbxTableReaderItemTrackByFunction<T> = ReadRequiredKeyFunction<T, DbxTableReaderItemKey>;

export interface DbxTableReaderDelegate<C, T, O> {
  /**
   * Retrieves the data for a specific column and item/row.
   *
   * @param column
   * @param item
   */
  readItemCellDataForColumn(column: DbxTableColumn<C>, item: T): Observable<O>;
  /**
   * Used for tracking unique columns.
   *
   * Use if the metadata between columns should be used for unique identification.
   *
   * Defaults to using the column name as the key if not defined.
   */
  trackColumn?: DbxTableReaderColumnTrackByFunction<C>;
  /**
   * Used for tracking unique items/rows.
   *
   * Use if the metadata between items should be used for unique identification.
   *
   * Defaults to using the item itself as the key if not defined.
   */
  trackItem: DbxTableReaderItemTrackByFunction<T>;
}

export interface DbxTableReader<C, T, O> {
  /**
   * Delegate used for retrieving the data for a specific column and item/row.
   */
  readonly delegate: DbxTableReaderDelegate<C, T, O>;
  /**
   * Retrieves all cell data pairs for a specific column.
   */
  cellDataPairsForColumn(column: DbxTableColumn<C>): Observable<DbxTableReaderCellDataPair<C, T, O>[]>;
  /**
   * Retrieves all cell data for a specific column.
   */
  cellDataForColumn(column: DbxTableColumn<C>): Observable<O[]>;
  /**
   * Retrieves the cell data pair for a specific column and item.
   *
   * Returns null if the column is not visible or the item is not found.
   */
  cellDataPairForColumnAndItem(column: DbxTableColumn<C>, item: T): Observable<Maybe<DbxTableReaderCellDataPair<C, T, O>>>;
  /**
   * Retrieves the cell data for a specific column and item.
   *
   * Returns null if the column is not visible or the item is not found.
   */
  cellDataForColumnAndItem(column: DbxTableColumn<C>, item: T): Observable<Maybe<O>>;
}

export interface DbxTableReaderConfig<C, T, O> {
  /**
   * Delegate used for retrieving the data for a specific column and item/row.
   */
  readonly delegate: DbxTableReaderDelegate<C, T, O>;
  /**
   * The table store used for retrieving the items.
   */
  readonly tableStore: DbxTableStore<unknown, C, T>;
}

export function dbxTableReader<C, T, O>(config: DbxTableReaderConfig<C, T, O>): DbxTableReader<C, T, O> {
  const { delegate, tableStore } = config;
  const { items$ } = tableStore;
  const { readItemCellDataForColumn, trackColumn: inputTrackColumn, trackItem } = delegate;
  const trackColumn = (inputTrackColumn ?? DEFAULT_DBX_TABLE_READER_COLUMN_TRACK_BY) as DbxTableReaderColumnTrackByFunction<C>;

  interface DbxTableReaderCellDataAccessorsForColumn {
    readonly column: DbxTableColumn<C>;
    readonly allValues$: Observable<DbxTableReaderCellDataPair<C, T, O>[]>;
    readonly accessorsRecord: DbxTableReaderCellDataAccessorsForColumnRecord;
  }

  type DbxTableReaderCellDataAccessorsForColumnRecord = Record<DbxTableReaderItemKey, Observable<DbxTableReaderCellDataPair<C, T, O>>>;

  const _cellDataAccessorsForColumn = (column: DbxTableColumn<C>): Observable<DbxTableReaderCellDataAccessorsForColumn> => {
    return items$.pipe(
      map((x) => {
        const allObservables: Observable<DbxTableReaderCellDataPair<C, T, O>>[] = [];
        const accessorsRecord: DbxTableReaderCellDataAccessorsForColumnRecord = {};

        x.forEach((item) => {
          const itemKey = trackItem(item);
          const accessor$ = readItemCellDataForColumn(column, item).pipe(
            map((value) => {
              return {
                column,
                item,
                value
              };
            })
          );

          accessorsRecord[itemKey] = accessor$;
          allObservables.push(accessor$);
        });

        const allValues$ = combineLatest(allObservables).pipe(startWith([]), shareReplay(1));

        return {
          column,
          allValues$,
          accessorsRecord
        };
      }),
      shareReplay(1)
    );
  };

  interface DbxTableReaderColumnDataCellsAccessor {
    readonly columnKey: DbxTableReaderColumnKey;
    readonly column: DbxTableColumn<C>;
    readonly cellDataAccessors$: Observable<DbxTableReaderCellDataAccessorsForColumn>;
    readonly cellData$: Observable<DbxTableReaderCellDataPair<C, T, O>[]>;
  }

  function columnDataCellsAccessor(columnKey: DbxTableReaderColumnKey, column: DbxTableColumn<C>): DbxTableReaderColumnDataCellsAccessor {
    const cellDataAccessors$ = _cellDataAccessorsForColumn(column);
    const cellData$ = cellDataAccessors$.pipe(
      switchMap((record) => record.allValues$),
      startWith([]),
      shareReplay(1)
    );

    return {
      columnKey,
      column,
      cellDataAccessors$,
      cellData$
    };
  }

  interface DbxTableReaderColumnDataAccumulator {
    readonly record: DbxTableReaderColumnDataRecord;
  }

  type DbxTableReaderColumnDataRecord = Record<DbxTableReaderColumnKey, DbxTableReaderColumnDataCellsAccessor>;

  const allColumnsData$: Observable<DbxTableReaderColumnDataAccumulator> = tableStore.columns$.pipe(
    map((nextColumns: DbxTableColumn<C>[]) => {
      const record: DbxTableReaderColumnDataRecord = {};

      nextColumns.forEach((column) => {
        const columnKey = trackColumn(column);
        record[columnKey] = columnDataCellsAccessor(columnKey, column);
      });

      return {
        record
      };
    }),
    shareReplay(1)
  );

  const _columnAccessorForColumn = (column: DbxTableColumn<C>): Observable<Maybe<DbxTableReaderColumnDataCellsAccessor>> => {
    const columnKey = trackColumn(column);
    return allColumnsData$.pipe(
      map((columnsData) => columnsData.record[columnKey]),
      shareReplay(1)
    );
  };

  const loadCellDataPairsForColumn = (column: DbxTableColumn<C>): Observable<DbxTableReaderCellDataPair<C, T, O>[]> => {
    const columnsData$ = _columnAccessorForColumn(column).pipe(
      switchMap((accessor) => {
        // when visibility changes, the data will change to be an empty array
        return accessor ? accessor.cellData$ : of([]);
      }),
      shareReplay(1)
    );

    return columnsData$;
  };

  const cellDataPairsForColumn = (column: DbxTableColumn<C>): Observable<DbxTableReaderCellDataPair<C, T, O>[]> => {
    return loadCellDataPairsForColumn(column);
  };

  const cellDataForColumn = (column: DbxTableColumn<C>): Observable<O[]> => {
    return cellDataPairsForColumn(column).pipe(
      map((pairs) => filterMaybeArrayValues(pairs.map((pair) => pair.value))),
      shareReplay(1)
    );
  };

  const cellDataPairForColumnAndItem = (column: DbxTableColumn<C>, item: T): Observable<Maybe<DbxTableReaderCellDataPair<C, T, O>>> => {
    const itemKey = trackItem(item);
    const columnsData$ = _columnAccessorForColumn(column).pipe(
      switchMap((columnsData) => {
        return columnsData
          ? columnsData.cellDataAccessors$.pipe(
              switchMap((cellDataAccessor) => {
                const itemAccessor = cellDataAccessor.accessorsRecord[itemKey];
                const result: Observable<Maybe<DbxTableReaderCellDataPair<C, T, O>>> = itemAccessor ? itemAccessor : of(null);
                return result;
              })
            )
          : of(null);
      }),
      shareReplay(1)
    );

    return columnsData$;
  };

  const cellDataForColumnAndItem = (column: DbxTableColumn<C>, item: T): Observable<Maybe<O>> => {
    return cellDataPairForColumnAndItem(column, item).pipe(map((pair) => pair?.value));
  };

  return {
    delegate,
    cellDataPairsForColumn,
    cellDataForColumn,
    cellDataPairForColumnAndItem,
    cellDataForColumnAndItem
  };
}
