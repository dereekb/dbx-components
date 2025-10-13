import { combineLatest, exhaustMap, filter, map, Observable, of, scan, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { DbxTableColumn, DbxTableStore, DbxTableContextData } from '@dereekb/dbx-web/table';
import { Maybe, arrayToObject, SetDeltaChange, SetDeltaChangePair, setDeltaFunction, SetValueIsModifiedFunction, filterMaybeArrayValues } from '@dereekb/util';
import { filterMaybeArray } from '@dereekb/rxjs';
import { DbxTableReaderColumnTrackByFunction, DbxTableReaderItemTrackByFunction, DbxTableReaderCellDataPair, DEFAULT_DBX_TABLE_READER_COLUMN_TRACK_BY, DbxTableReaderItemKey, DbxTableReaderColumnKey } from './table.reader';

export interface CachedDbxTableReaderDelegate<C, T, O> {
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
  /**
   * Optional function used to determine if an item has been modified.
   *
   * If not defined, then the item will be checked for equality using !==.
   */
  itemIsModified?: SetValueIsModifiedFunction<T>;
  /**
   * Retrieves the data for a specific column and item/row.
   *
   * @param column
   * @param item
   */
  readItemCellDataForColumn(column: DbxTableColumn<C>, item: T): Observable<O>;
}

export interface CachedDbxTableReader<C, T, O> {
  /**
   * Delegate used for retrieving the data for a specific column and item/row.
   */
  readonly delegate: CachedDbxTableReaderDelegate<C, T, O>;
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

export interface CachedDbxTableReaderConfig<C, T, O> {
  /**
   * Delegate used for retrieving the data for a specific column and item/row.
   */
  readonly delegate: CachedDbxTableReaderDelegate<C, T, O>;
  /**
   * The table store used for retrieving the items.
   */
  readonly tableStore: DbxTableStore<unknown, C, T>;
  /**
   * Maximum number of columns to cache.
   *
   * If a table has more columns than the maximum, then they will all be retained until the number of columns drops below the maximum.
   *
   * Defaults to 300.
   */
  readonly maxColumnCacheSize?: Maybe<number>;
}

/**
 * @deprecated does not work properly, and is not used in the codebase. Is preserved incase it is needed in the future.
 *
 * @param config
 * @returns
 */
export function cachedDbxTableReader<C, T, O>(config: CachedDbxTableReaderConfig<C, T, O>): CachedDbxTableReader<C, T, O> {
  const { delegate, tableStore, maxColumnCacheSize: inputMaxColumnCacheSize } = config;
  const { items$ } = tableStore;
  const { readItemCellDataForColumn, trackColumn: inputTrackColumn, itemIsModified: inputItemIsModified, trackItem } = delegate;
  const itemIsModified = inputItemIsModified ?? ((a, b) => a !== b);
  const trackColumn = (inputTrackColumn ?? DEFAULT_DBX_TABLE_READER_COLUMN_TRACK_BY) as DbxTableReaderColumnTrackByFunction<C>;

  type DbxTableReaderItemKeyDeltaChangeRecord = Record<DbxTableReaderItemKey, SetDeltaChangePair<DbxTableReaderItemKeyPair, DbxTableReaderItemKey>>;
  type DbxTableReaderItemKeyPair = [DbxTableReaderItemKey, T];

  interface DbxTableReaderItemKeyRecordAccumulator {
    /**
     * All items
     */
    readonly items: DbxTableReaderItemKeyPair[];
    /**
     * Changes to the items
     */
    readonly changes: SetDeltaChangePair<DbxTableReaderItemKeyPair, DbxTableReaderItemKey>[];
    /**
     * Record of items
     */
    readonly changesRecord: DbxTableReaderItemKeyDeltaChangeRecord;
  }

  const calculateItemsDelta = setDeltaFunction<DbxTableReaderItemKeyPair>({
    readKey: (x) => x[0],
    isModifiedFunction: (a, b) => itemIsModified(a[1], b[1])
  });

  /**
   * Observable that tracks which items are new/old when items changes, and returns a new array.
   */
  const nextItems$ = items$.pipe(
    scan(
      (currentRecord: DbxTableReaderItemKeyRecordAccumulator, nextItems: T[]) => {
        const items: DbxTableReaderItemKeyPair[] = nextItems.map((item) => {
          const key = trackItem(item);
          return [key, item] as const;
        });

        const changes = calculateItemsDelta(currentRecord.items, items);
        const changesRecord = arrayToObject(
          changes,
          (x) => x.key,
          (x) => x
        );

        const nextAccumulator: DbxTableReaderItemKeyRecordAccumulator = {
          changes,
          changesRecord,
          items
        };

        return nextAccumulator;
      },
      {
        changes: [],
        changesRecord: {},
        items: []
      }
    ),
    shareReplay(1)
  );

  /**
   * Maximum number of columns to cache.
   */
  const maxColumnCacheSize = inputMaxColumnCacheSize ?? 300;

  let nextColumnCacheId = 0;

  interface DbxTableReaderColumnDataCellsAccessor {
    readonly columnCacheId: number;
    readonly columnKey: DbxTableReaderColumnKey;
    readonly column: DbxTableColumn<C>;
    readonly _cellDataRecord$: Observable<DbxTableReaderItemDataCellDataRecord>;
    readonly cellData$: Observable<DbxTableReaderCellDataPair<C, T, O>[]>;
  }

  type DbxTableReaderItemDataCellDataPairAccessor = Observable<Maybe<DbxTableReaderCellDataPair<C, T, O>>>;

  type DbxTableReaderItemDataCellDataRecord = Record<DbxTableReaderColumnKey, DbxTableReaderItemDataCellDataPairAccessor>;

  // type LoadCellDataPairForColumnAndItem = Readonly<[true, DbxTableReaderItemDataCellDataRecord] | [false, null]>;

  const _loadCellDataPairForColumnAndItem = (column: DbxTableColumn<C>, itemKey: DbxTableReaderItemKey): Observable<Maybe<DbxTableReaderCellDataPair<C, T, O>>> => {
    return nextItems$.pipe(
      map((record) => record.changesRecord[itemKey]),
      filter((change) => Boolean((change.change !== SetDeltaChange.NONE || change.isModified) && change.value)), // do not emit unless changed, and unless it has a value
      switchMap((change) => {
        let result: Observable<Maybe<DbxTableReaderCellDataPair<C, T, O>>>;

        if (itemKey === 'jl/ujbSHnqFkxF0g0NWAh2F/jlj/fbbfnDxck3eBYSiLJiu9/jljt/eCcWlLtad3FgwdrqUk5KnXoIktD3' && column.columnName === '2025-06-23') {
          console.log('change', {
            change,
            column,
            itemKey
          });
        }

        if (change.change === SetDeltaChange.REMOVED) {
          result = of(null); // if removed, then emit null
        } else {
          const item = change.value[1];
          result = readItemCellDataForColumn(column, item).pipe(
            map((value) => {
              const dataPair: DbxTableReaderCellDataPair<C, T, O> = {
                column,
                item,
                value
              };

              console.log('dataPair', {
                dataPair,
                column,
                itemKey
              });

              return dataPair;
            })
          );
        }

        return result;
      }),
      tap((value) => {
        if (itemKey === 'jl/ujbSHnqFkxF0g0NWAh2F/jlj/fbbfnDxck3eBYSiLJiu9/jljt/eCcWlLtad3FgwdrqUk5KnXoIktD3' && column.columnName === '2025-06-23') {
          console.log('value out', {
            value,
            column,
            itemKey
          });
        }
      }),
      shareReplay(1)
    );
  };

  const _cellDataRecordForColumn = (column: DbxTableColumn<C>): Observable<DbxTableReaderItemDataCellDataRecord> => {
    return nextItems$.pipe(
      scan<DbxTableReaderItemKeyRecordAccumulator, DbxTableReaderItemDataCellDataRecord>((currentRecord: DbxTableReaderItemDataCellDataRecord, nextData: DbxTableReaderItemKeyRecordAccumulator) => {
        // when new items data comes in, we update the items for that column
        const nextAccumulator: DbxTableReaderItemDataCellDataRecord = {
          ...currentRecord
        };

        nextData.changes.forEach((change) => {
          switch (change.change) {
            case SetDeltaChange.ADDED:
              nextAccumulator[change.key] = _loadCellDataPairForColumnAndItem(column, change.key);
              break;
            case SetDeltaChange.REMOVED:
              delete nextAccumulator[change.key]; // remove from the record
              break;
            case SetDeltaChange.NONE:
              // do nothing/keep the existing value
              break;
          }
        });

        if (column.columnName === '2025-06-23') {
          console.log('nextAccumulator', {
            column,
            nextData,
            nextAccumulator
          });
        }

        return nextAccumulator;
      }, {} as DbxTableReaderItemDataCellDataRecord)
    );
  };

  function columnDataCellsAccessor(columnKey: DbxTableReaderColumnKey, column: DbxTableColumn<C>): DbxTableReaderColumnDataCellsAccessor {
    const columnCacheId = nextColumnCacheId;

    nextColumnCacheId += 1;

    const _cellDataRecord$ = _cellDataRecordForColumn(column);
    const cellData$ = _cellDataRecord$.pipe(
      switchMap((record) => {
        const observables: Observable<Maybe<DbxTableReaderCellDataPair<C, T, O>>>[] = [];

        Object.values(record).forEach((observable) => {
          observables.push(observable);
        });

        return combineLatest(observables).pipe(filterMaybeArray(), startWith([]));
      }),
      tap((cellData) => {
        if (column.columnName === '2025-06-23') {
          console.log('next cellData', {
            column,
            cellData
          });
        }
      }),
      shareReplay(1)
    );

    return {
      columnCacheId,
      columnKey,
      column,
      _cellDataRecord$,
      cellData$
    };
  }

  interface DbxTableReaderColumnDataAccumulator {
    readonly record: DbxTableReaderColumnDataRecord;
    readonly visibleColumnKeys: Set<DbxTableReaderColumnKey>;
  }

  type DbxTableReaderColumnDataRecord = Record<DbxTableReaderColumnKey, DbxTableReaderColumnDataCellsAccessor>;

  const allColumnsData$: Observable<DbxTableReaderColumnDataAccumulator> = tableStore.data$.pipe(
    scan<DbxTableContextData<unknown, C, T>, DbxTableReaderColumnDataAccumulator>(
      (currentAccumulator: DbxTableReaderColumnDataAccumulator, nextData: DbxTableContextData<unknown, C, T>) => {
        const { record: currentRecord } = currentAccumulator;
        const totalTableColumns = nextData.columns.length;

        const nextColumns = nextData.columns.map((column) => {
          const key = trackColumn(column) as DbxTableReaderColumnKey;
          return [key, column] as const;
        });

        const onlyNewColumns = nextColumns; // .filter(([key]) => !currentRecord[key]);

        const nextAccumulatorRecord: DbxTableReaderColumnDataRecord = {
          // ...currentRecord
        };

        // add to the accumulators cache
        onlyNewColumns.forEach(([key, column]) => {
          nextAccumulatorRecord[key] = columnDataCellsAccessor(key, column);
        });

        // if the accumulators cache is full, remove the oldest columns
        if (totalTableColumns < maxColumnCacheSize) {
          const cacheEntries = Object.entries(nextAccumulatorRecord);

          if (cacheEntries.length > maxColumnCacheSize) {
            const oldestColumnIdsToRetain = nextColumnCacheId - maxColumnCacheSize;

            cacheEntries.forEach(([key, value]) => {
              if (value.columnCacheId < oldestColumnIdsToRetain) {
                delete nextAccumulatorRecord[key];
              }
            });
          }
        }

        const result = {
          record: nextAccumulatorRecord,
          visibleColumnKeys: new Set(nextColumns.map(([key]) => key))
        };

        console.log('columns update', {
          nextAccumulatorRecord,
          nextColumns,
          visibleColumnKeys: result.visibleColumnKeys
        });

        return result;
      },
      {
        record: {},
        visibleColumnKeys: new Set()
      } as DbxTableReaderColumnDataAccumulator
    ),
    shareReplay(1)
  );

  type ColumnAccessorPair = Readonly<[true, DbxTableReaderColumnDataCellsAccessor] | [false, null]>;

  const _columnAccessorForColumn = (column: DbxTableColumn<C>): Observable<ColumnAccessorPair> => {
    const columnKey = trackColumn(column);
    return allColumnsData$.pipe(
      map((columnsData) => {
        const isVisible = columnsData.visibleColumnKeys.has(columnKey);
        const accessor = columnsData.record[columnKey];

        console.log({
          columnKey,
          isVisible,
          accessor
        });

        return isVisible && accessor != null ? ([true, accessor] as const) : ([false, null] as const);
      }),
      // distinctUntilChanged<ColumnAccessorPair>((([visA], [visB]) => visA === visB)),
      shareReplay(1)
    );
  };

  const loadCellDataPairsForColumn = (column: DbxTableColumn<C>): Observable<DbxTableReaderCellDataPair<C, T, O>[]> => {
    const columnsData$ = _columnAccessorForColumn(column).pipe(
      switchMap(([isVisible, accessor]) => {
        // when visibility changes, the data will change to be an empty array
        return isVisible ? (accessor as DbxTableReaderColumnDataCellsAccessor).cellData$ : of([]);
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
        const accessor = columnsData[0] ? columnsData[1] : undefined;
        return accessor ? accessor._cellDataRecord$.pipe(exhaustMap((record) => record[itemKey])) : of(null);
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
