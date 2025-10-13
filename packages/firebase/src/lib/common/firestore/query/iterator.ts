import { type PageLoadingState, ItemPageIterator, type ItemPageIterationInstance, type ItemPageIterationConfig, type ItemPageIteratorDelegate, type ItemPageIteratorRequest, type ItemPageIteratorResult, type MappedPageItemIterationInstance, type ItemPageLimit, mappedPageItemIteration } from '@dereekb/rxjs';
import { DocumentReference, Query, QueryDocumentSnapshot, type QueryDocumentSnapshotArray, type QuerySnapshot, type SnapshotListenOptions } from '../types';
import { asArray, type Maybe, lastValue, mergeArraysIntoArray, type ArrayOrValue, IndexNumber } from '@dereekb/util';
import { from, type Observable, of, exhaustMap } from 'rxjs';
import { type FirestoreQueryDriverRef } from '../driver/query';
import { FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, type FirestoreQueryConstraint, limit, startAfter } from './constraint';
import { type QueryLikeReferenceRef } from '../reference';
import { LimitedFirestoreDocumentAccessor } from '../accessor/document';
import { getDocumentSnapshots, loadDocumentsForDocumentReferences } from '../accessor/document.utility';

/**
 * Filter configuration for Firestore query pagination.
 *
 * This interface defines how to filter and limit paginated Firestore queries.
 * It allows specifying both a query limit and additional query constraints.
 */
export interface FirestoreItemPageIteratorFilter extends ItemPageLimit {
  /**
   * Overrides the default limit of items per page, if specified.
   *
   * This allows dynamically changing the number of items retrieved in each query
   * without changing the base configuration.
   */
  readonly limit?: Maybe<number>;

  /**
   * Query constraints to apply to the paginated query.
   *
   * These can include filtering conditions (where), sorting (orderBy), etc.
   * Note that some constraints like 'limit' will be handled automatically
   * and should not be included here.
   */
  readonly constraints?: Maybe<ArrayOrValue<FirestoreQueryConstraint>>;
}

/**
 * Base configuration for Firestore query pagination.
 *
 * This interface defines the core settings needed for paginated Firestore queries,
 * including the query reference, driver, and pagination settings.
 *
 * @template T - The document data type in the query results
 */
export interface FirestoreItemPageIterationBaseConfig<T> extends QueryLikeReferenceRef<T>, FirestoreQueryDriverRef, ItemPageLimit {
  /**
   * Number of items to retrieve per page in each query.
   *
   * This controls the size of each "page" of results. Larger values mean
   * fewer total queries but more data transferred per query.
   *
   * @default 50
   */
  readonly itemsPerPage?: number;
}

/**
 * Complete configuration for Firestore query pagination.
 *
 * Combines the base Firestore configuration with the generic pagination configuration,
 * providing all settings needed for paginated Firestore queries.
 *
 * @template T - The document data type in the query results
 */
export interface FirestoreItemPageIterationConfig<T> extends FirestoreItemPageIterationBaseConfig<T>, ItemPageIterationConfig<FirestoreItemPageIteratorFilter> {}

/**
 * Results from a paginated Firestore query.
 *
 * This interface encapsulates the results of a single "page" query in a paginated
 * Firestore query sequence. It includes both the raw query snapshot and convenient
 * accessors for the document data, along with methods to reload or stream the results.
 *
 * @template T - The document data type in the query results
 */
export interface FirestoreItemPageQueryResult<T> {
  /**
   * Timestamp when the result was retrieved.
   *
   * Useful for tracking when data was last fetched or for implementing
   * time-based caching strategies.
   */
  readonly time: Date;

  /**
   * Document snapshots for this page of results.
   *
   * This array contains the document snapshots returned by the query,
   * excluding any cursor document used for pagination.
   */
  readonly docs: QueryDocumentSnapshotArray<T>;

  /**
   * The complete query snapshot returned by Firestore.
   *
   * This provides access to all metadata and methods of the raw query
   * snapshot, including size, query information, and document changes.
   */
  readonly snapshot: QuerySnapshot<T>;

  /**
   * Reloads the current page of results.
   *
   * This method re-executes the exact same query that produced these results,
   * fetching the latest data from Firestore. Useful for refreshing data
   * without changing pagination position.
   *
   * @returns A promise that resolves with the fresh query snapshot
   */
  reload(): Promise<QuerySnapshot<T>>;

  /**
   * Creates an Observable that streams updates to this query.
   *
   * This method establishes a real-time listener for the current page query,
   * emitting new snapshots whenever the underlying data changes.
   *
   * @param options - Optional configuration for the snapshot listener
   * @returns An Observable of query snapshots that updates in real-time
   */
  stream(options?: FirestoreItemPageQueryResultStreamOptions): Observable<QuerySnapshot<T>>;
}

/**
 * Options for streaming real-time updates to a Firestore query page.
 *
 * This interface allows configuring how the real-time listener behaves
 * when streaming updates to a page of Firestore query results.
 */
export interface FirestoreItemPageQueryResultStreamOptions {
  /**
   * Optional Firestore snapshot listener options.
   *
   * These options control aspects of the snapshot listener like whether to include metadata
   * changes or wait for a server snapshot.
   */
  readonly options?: Maybe<SnapshotListenOptions>;
}

export type FirestoreItemPageIteratorDelegate<T> = ItemPageIteratorDelegate<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>;
export type InternalFirestoreItemPageIterationInstance<T> = ItemPageIterationInstance<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>;

/**
 * Filters out constraints that should not be directly specified in pagination queries.
 *
 * This utility function removes constraints that would conflict with the pagination
 * mechanics, such as 'limit' constraints which are automatically added by the paginator.
 *
 * @param constraints - Array of query constraints to filter
 * @returns Filtered array with disallowed constraints removed
 */
export function filterDisallowedFirestoreItemPageIteratorInputConstraints(constraints: FirestoreQueryConstraint[]): FirestoreQueryConstraint[] {
  const isIllegal = new Set([FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]);
  return constraints.filter((x) => !isIllegal.has(x.type));
}

/**
 * Default number of items to retrieve per page in paginated Firestore queries.
 *
 * This value is used when no itemsPerPage is explicitly specified in the configuration.
 */
export const DEFAULT_FIRESTORE_ITEM_PAGE_ITERATOR_ITEMS_PER_PAGE = 50;

export function makeFirestoreItemPageIteratorDelegate<T>(): FirestoreItemPageIteratorDelegate<T> {
  return {
    loadItemsForPage: (request: ItemPageIteratorRequest<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>): Observable<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>> => {
      const { page, iteratorConfig } = request;
      const prevQueryResult$: Observable<Maybe<FirestoreItemPageQueryResult<T>>> = page > 0 ? request.lastItem$ : of(undefined);

      const { queryLike, itemsPerPage = DEFAULT_FIRESTORE_ITEM_PAGE_ITERATOR_ITEMS_PER_PAGE, filter, firestoreQueryDriver: driver } = iteratorConfig;
      const { limit: filterLimit, constraints: filterConstraints } = filter ?? {};

      return prevQueryResult$.pipe(
        exhaustMap((prevResult) => {
          if (prevResult?.snapshot.empty === true) {
            // TODO(REMOVE): Shouldn't happen. Remove this later.
            return of<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>>({ end: true });
          } else {
            const constraints: FirestoreQueryConstraint[] = [];

            // Add filter constraints
            if (filterConstraints != null) {
              mergeArraysIntoArray(constraints, filterDisallowedFirestoreItemPageIteratorInputConstraints(asArray(filterConstraints)));
            }

            // Add cursor
            const cursorDocument = prevResult ? lastValue(prevResult.docs) : undefined;
            const startAfterFilter = cursorDocument ? startAfter(cursorDocument) : undefined;

            if (startAfterFilter) {
              constraints.push(startAfterFilter);
            }

            // Add Limit
            const limitCount = filterLimit ?? itemsPerPage + (startAfterFilter ? 1 : 0); // todo: may not be needed.
            const limitConstraint = limit(limitCount);
            const constraintsWithLimit = [...constraints, limitConstraint];

            // make query
            const batchQuery = driver.query<T>(queryLike, ...constraintsWithLimit);
            const resultPromise: Promise<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>> = driver.getDocs(batchQuery).then((snapshot) => {
              const time = new Date();
              const docs = snapshot.docs;

              const result: ItemPageIteratorResult<FirestoreItemPageQueryResult<T>> = {
                value: {
                  time,
                  docs,
                  snapshot,
                  reload() {
                    return driver.getDocs(batchQuery);
                  },
                  stream(options?: FirestoreItemPageQueryResultStreamOptions) {
                    // todo: consider allowing limit to be changed here to stream a subset. This will be useful for detecting collection changes.
                    return driver.streamDocs(batchQuery, options?.options);
                  }
                },
                end: snapshot.empty
              };

              return result;
            });

            return from(resultPromise);
          }
        })
      );
    }
  };
}

export interface FirestoreItemPageIteration<T> extends MappedPageItemIterationInstance<QueryDocumentSnapshotArray<T>, FirestoreItemPageQueryResult<T>, PageLoadingState<QueryDocumentSnapshotArray<T>>, PageLoadingState<FirestoreItemPageQueryResult<T>>, InternalFirestoreItemPageIterationInstance<T>> {
  /**
   * The underlying iteration instance that works with raw query snapshots.
   *
   * This provides access to the snapshot-level pagination when needed, which is useful
   * for accessing metadata or other snapshot-specific features not available in the
   * mapped document arrays.
   */
  readonly snapshotIteration: InternalFirestoreItemPageIterationInstance<T>;
}

/**
 * Instance for paginated iteration over Firestore documents.
 *
 * This interface represents a configured paginator for Firestore documents. It extends the
 * generic mapped page iteration system to work specifically with Firestore documents,
 * providing both the document arrays and access to the underlying snapshot iteration.
 *
 * @template T - The document data type in the query results
 */
export interface FirestoreItemPageIterationInstance<T> extends FirestoreItemPageIteration<T> {
  readonly snapshotIteration: InternalFirestoreItemPageIterationInstance<T>;
}

// MARK: Iteration Factory
/**
 * Factory for creating Firestore pagination instances.
 *
 * This interface provides a standardized way to create pagination instances
 * for Firestore queries with consistent configuration.
 *
 * @template T - The document data type in the query results
 */
export interface FirestoreItemPageIterationFactory<T> {
  /**
   * Function that creates pagination instances with consistent base configuration.
   *
   * This factory function allows creating multiple pagination instances that share
   * the same base configuration but can have different filters applied.
   */
  readonly firestoreIteration: FirestoreItemPageIterationFactoryFunction<T>;
  /**
   * Function that creates fixed pagination instances with consistent base configuration.
   */
  readonly firestoreFixedIteration: FirestoreFixedItemPageIterationFactoryFunction<T>;
}

/**
 * Function that creates a Firestore pagination instance using the specified filter.
 *
 * This type represents a factory function that creates pagination instances with
 * predefined base configuration. The only parameter needed is the filter that specifies
 * what constraints to apply and how many items to load per page.
 *
 * @template T - The document data type in the query results
 */
export type FirestoreItemPageIterationFactoryFunction<T> = (filter?: FirestoreItemPageIteratorFilter) => FirestoreItemPageIterationInstance<T>;

/**
 * Creates a factory function for generating Firestore pagination instances with consistent base configuration.
 *
 * This higher-order function takes a base configuration and returns a specialized factory function
 * that can create properly configured pagination instances. This is useful when you need to create
 * multiple pagination instances for the same collection but with different filters.
 *
 * @template T - The document data type in the query results
 * @param baseConfig - The base configuration shared by all created pagination instances
 * @returns A factory function that creates pagination instances with the specified base configuration
 *
 * @example
 * // Create a factory for paginating users collection
 * const usersQuery = collection(firestore, 'users');
 * const usersPaginator = firestoreItemPageIterationFactory({
 *   queryLike: usersQuery,
 *   itemsPerPage: 20,
 *   firestoreQueryDriver: driver
 * });
 *
 * // Create specific pagination instances with different filters
 * const activePaginator = usersPaginator({
 *   constraints: [where('status', '==', 'active')]
 * });
 * const adminPaginator = usersPaginator({
 *   constraints: [where('role', '==', 'admin')]
 * });
 */
export function firestoreItemPageIterationFactory<T>(baseConfig: FirestoreItemPageIterationBaseConfig<T>): FirestoreItemPageIterationFactoryFunction<T> {
  return (filter?: FirestoreItemPageIteratorFilter) => {
    const result: FirestoreItemPageIterationInstance<T> = firestoreItemPageIteration<T>({
      queryLike: baseConfig.queryLike,
      itemsPerPage: baseConfig.itemsPerPage,
      firestoreQueryDriver: baseConfig.firestoreQueryDriver,
      maxPageLoadLimit: filter?.maxPageLoadLimit ?? baseConfig.maxPageLoadLimit,
      filter
    });

    return result;
  };
}

/**
 * Default delegate that implements Firestore pagination logic.
 *
 * This singleton instance handles the core logic of paginated Firestore queries,
 * including cursor management and document fetching.
 */
export const FIRESTORE_ITEM_PAGE_ITERATOR_DELEGATE: FirestoreItemPageIteratorDelegate<unknown> = makeFirestoreItemPageIteratorDelegate();

/**
 * Default iterator that provides Firestore pagination functionality.
 *
 * This singleton instance is the core pagination iterator used by the library.
 * It uses the default delegate to implement paginated Firestore queries.
 */
export const FIRESTORE_ITEM_PAGE_ITERATOR = new ItemPageIterator<FirestoreItemPageQueryResult<unknown>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<unknown>>(FIRESTORE_ITEM_PAGE_ITERATOR_DELEGATE);

/**
 * Creates a Firestore pagination instance that handles loading documents in pages.
 *
 * This function creates a pagination instance that loads Firestore documents in pages,
 * automatically handling cursor-based pagination. It returns a mapped iteration instance
 * that directly provides document arrays while also exposing access to the underlying
 * snapshot iteration.
 *
 * @template T - The document data type in the query results
 * @param config - The configuration for the pagination
 * @returns A Firestore pagination instance that loads documents in pages
 *
 * @example
 * // Create a pagination instance for a users collection
 * const usersPagination = firestoreItemPageIteration({
 *   queryLike: collection(firestore, 'users'),
 *   itemsPerPage: 10,
 *   firestoreQueryDriver: driver,
 *   filter: {
 *     constraints: [where('status', '==', 'active'), orderBy('createdAt', 'desc')]
 *   }
 * });
 *
 * // Load the first page of results
 * const firstPage = await usersPagination.loadNextPage().toPromise();
 * console.log('First 10 users:', firstPage);
 *
 * // Load the next page when needed
 * const secondPage = await usersPagination.loadNextPage().toPromise();
 * console.log('Next 10 users:', secondPage);
 */
export function firestoreItemPageIteration<T>(config: FirestoreItemPageIterationConfig<T>): FirestoreItemPageIterationInstance<T> {
  const snapshotIteration: InternalFirestoreItemPageIterationInstance<T> = FIRESTORE_ITEM_PAGE_ITERATOR.instance(config) as InternalFirestoreItemPageIterationInstance<T>;
  return _firestoreItemPageIterationWithSnapshotIteration(snapshotIteration);
}

function _firestoreItemPageIterationWithSnapshotIteration<T>(snapshotIteration: InternalFirestoreItemPageIterationInstance<T>): FirestoreItemPageIterationInstance<T> {
  const mappedIteration = mappedPageItemIteration(snapshotIteration, {
    forwardDestroy: true,
    mapValue: (x: FirestoreItemPageQueryResult<T>) => x.docs
  });

  const result: FirestoreItemPageIterationInstance<T> = {
    ...mappedIteration,
    snapshotIteration
  };

  return result;
}

// MARK: FixedItemPageIteration
/**
 * Function that creates a Firestore pagination instance using the input items and optional filter.
 *
 * This type represents a factory function that creates pagination instances with
 * predefined base configuration. The only parameter needed is the filter that specifies
 * what constraints to apply and how many items to load per page.
 *
 * @template T - The document data type in the query results
 */
export type FirestoreFixedItemPageIterationFactoryFunction<T> = (items: DocumentReference<T>[], filter?: FirestoreItemPageIteratorFilter) => FirestoreItemPageIterationInstance<T>;

/**
 * Creates a FirestoreFixedItemPageIterationFactoryFunction.
 */
export function firestoreFixedItemPageIterationFactory<T>(baseConfig: FirestoreItemPageIterationConfig<T>, documentAccessor: LimitedFirestoreDocumentAccessor<T>): FirestoreFixedItemPageIterationFactoryFunction<T> {
  return (items: DocumentReference<T>[], filter?: FirestoreItemPageIteratorFilter) => {
    const result: FirestoreItemPageIterationInstance<T> = firestoreFixedItemPageIteration<T>({
      items,
      documentAccessor,
      queryLike: baseConfig.queryLike,
      itemsPerPage: baseConfig.itemsPerPage,
      firestoreQueryDriver: baseConfig.firestoreQueryDriver,
      maxPageLoadLimit: filter?.maxPageLoadLimit ?? baseConfig.maxPageLoadLimit,
      filter
    });

    return result;
  };
}

export interface FirestoreFixedItemPageIterationConfig<T> extends FirestoreItemPageIterationConfig<T> {
  readonly items: DocumentReference<T>[];
  readonly documentAccessor: LimitedFirestoreDocumentAccessor<T>;
}

/**
 * Creates a FirestoreItemPageIterationInstance that iterates over the fixed
 */
export function firestoreFixedItemPageIteration<T>(config: FirestoreFixedItemPageIterationConfig<T>): FirestoreItemPageIterationInstance<T> {
  const { items, documentAccessor } = config;
  const idLookupMap = new Map<string, IndexNumber>();

  // used to cache the index for ids that are looked up
  const indexForId = (id: string) => {
    let index = idLookupMap.get(id);

    if (index === undefined) {
      index = items.findIndex((x) => x.id === id);
      idLookupMap.set(id, index);
    }

    return index;
  };

  const delegate: FirestoreItemPageIteratorDelegate<T> = {
    loadItemsForPage: (request: ItemPageIteratorRequest<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>): Observable<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>> => {
      const { page, iteratorConfig } = request;
      const prevQueryResult$: Observable<Maybe<FirestoreItemPageQueryResult<T>>> = page > 0 ? request.lastItem$ : of(undefined);

      const { itemsPerPage = DEFAULT_FIRESTORE_ITEM_PAGE_ITERATOR_ITEMS_PER_PAGE, filter } = iteratorConfig;
      const { limit: filterLimit } = filter ?? {};

      return prevQueryResult$.pipe(
        exhaustMap((prevResult) => {
          if (prevResult?.snapshot.empty === true) {
            // TODO(REMOVE): Shouldn't happen. Remove this later.
            return of<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>>({ end: true });
          } else {
            const cursorDocument = prevResult ? lastValue(prevResult.docs) : undefined;

            const startAtIndex = cursorDocument ? indexForId(cursorDocument.id) + 1 : 0;
            const limitCount = filterLimit ?? itemsPerPage;

            const time = new Date();
            const itemsForThisPage: DocumentReference<T>[] = items.slice(startAtIndex, startAtIndex + limitCount);

            const lastItemForThisPage = lastValue(itemsForThisPage);
            let end = false;

            if (lastItemForThisPage) {
              const lastItemForThisPageItemIndex = startAtIndex + (itemsForThisPage.length - 1);
              idLookupMap.set(lastItemForThisPage.id, lastItemForThisPageItemIndex);
              end = lastItemForThisPageItemIndex === items.length - 1;
            } else {
              end = true;
            }

            const documents = loadDocumentsForDocumentReferences(documentAccessor, itemsForThisPage);

            const _loadFakeQuerySnapshot = () => {
              return getDocumentSnapshots(documents).then((documentSnapshots) => {
                const documentSnapshotsWithData = documentSnapshots.filter((x) => x.data() != null) as QueryDocumentSnapshotArray<T>;
                const docs: QueryDocumentSnapshotArray<T> = documentSnapshotsWithData;

                const query: Query<T> = {
                  withConverter: () => {
                    throw new Error('firestoreFixedItemPageIteration(): Not a real query');
                  }
                } as unknown as Query<T>; // TODO: No great way to implement this. Not a great way to

                const snapshot: QuerySnapshot<T> = {
                  query,
                  docs,
                  size: docs.length,
                  empty: docs.length === 0,
                  docChanges: () => {
                    return []; // no changes to return in this fake snapshot
                  },
                  forEach: (result: (result: QueryDocumentSnapshot<T>) => void) => {
                    docs.forEach(result);
                  }
                };

                return snapshot;
              });
            };

            const resultPromise = _loadFakeQuerySnapshot().then((snapshot: QuerySnapshot<T>) => {
              const result: ItemPageIteratorResult<FirestoreItemPageQueryResult<T>> = {
                value: {
                  time,
                  docs: snapshot.docs,
                  snapshot,
                  reload() {
                    return _loadFakeQuerySnapshot();
                  },
                  stream(options?: FirestoreItemPageQueryResultStreamOptions) {
                    // TODO: Count potentially stream to fully implement, but might not be used anyways.
                    return of(snapshot);
                  }
                },
                end
              };

              return result;
            });

            return resultPromise;
          }
        })
      );
    }
  };

  const factory = new ItemPageIterator<FirestoreItemPageQueryResult<unknown>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<unknown>>(delegate);
  const snapshotIteration: InternalFirestoreItemPageIterationInstance<T> = factory.instance(config) as InternalFirestoreItemPageIterationInstance<T>;
  return _firestoreItemPageIterationWithSnapshotIteration(snapshotIteration);
}

// MARK: Compat
/**
 * @deprecated Use filterDisallowedFirestoreItemPageIteratorInputConstraints instead. Mispelling.
 */
export const filterDisallowedFirestoreItemPageIteratorInputContraints = filterDisallowedFirestoreItemPageIteratorInputConstraints;
