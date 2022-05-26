import { PageLoadingState, ItemPageIterator, ItemPageIterationInstance, ItemPageIterationConfig, ItemPageIteratorDelegate, ItemPageIteratorRequest, ItemPageIteratorResult, MappedPageItemIterationInstance, ItemPageLimit } from '@dereekb/rxjs';
import { QueryDocumentSnapshotArray, QuerySnapshot, SnapshotListenOptions } from '../types';
import { asArray, Maybe, lastValue, mergeIntoArray, ArrayOrValue } from '@dereekb/util';
import { from, Observable, of, exhaustMap } from 'rxjs';
import { CollectionReferenceRef } from '../reference';
import { FirestoreQueryDriverRef } from '../driver/query';
import { FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, FirestoreQueryConstraint, limit, startAfter } from './constraint';

export interface FirestoreItemPageIteratorFilter extends ItemPageLimit {
  /**
   * Overrides the default limit, if applicable.
   */
  limit?: Maybe<number>;
  /**
   * Constraints to query on.
   */
  constraints?: Maybe<ArrayOrValue<FirestoreQueryConstraint>>;
}

export interface FirestoreItemPageIterationBaseConfig<T> extends CollectionReferenceRef<T>, FirestoreQueryDriverRef, ItemPageLimit {
  itemsPerPage: number;
}

export interface FirestoreItemPageIterationConfig<T> extends FirestoreItemPageIterationBaseConfig<T>, ItemPageIterationConfig<FirestoreItemPageIteratorFilter> {}

export interface FirestoreItemPageQueryResult<T> {
  /**
   * Time the result was read at.
   */
  readonly time: Date;
  /**
   * The relevant docs for this page result. This value will omit the cursor.
   */
  readonly docs: QueryDocumentSnapshotArray<T>;
  /**
   * The raw snapshot returned from the query.
   */
  readonly snapshot: QuerySnapshot<T>;
  /**
   * Reloads these results as a snapshot.
   */
  reload(): Promise<QuerySnapshot<T>>;
  /**
   * Streams these results.
   */
  stream(options?: FirestoreItemPageQueryResultStreamOptions): Observable<QuerySnapshot<T>>;
}

export interface FirestoreItemPageQueryResultStreamOptions {
  options?: Maybe<SnapshotListenOptions>;
}

export type FirestoreItemPageIteratorDelegate<T> = ItemPageIteratorDelegate<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>;
export type InternalFirestoreItemPageIterationInstance<T> = ItemPageIterationInstance<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>;

export function filterDisallowedFirestoreItemPageIteratorInputContraints(constraints: FirestoreQueryConstraint[]): FirestoreQueryConstraint[] {
  const isIllegal = new Set([FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]);
  return constraints.filter((x) => !isIllegal.has(x.type));
}

export function makeFirestoreItemPageIteratorDelegate<T>(): FirestoreItemPageIteratorDelegate<T> {
  return {
    loadItemsForPage: (request: ItemPageIteratorRequest<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>): Observable<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>> => {
      const { page, iteratorConfig } = request;
      const prevQueryResult$: Observable<Maybe<FirestoreItemPageQueryResult<T>>> = page > 0 ? request.lastItem$ : of(undefined);

      const { collection, itemsPerPage, filter, firestoreQueryDriver: driver } = iteratorConfig;
      const { limit: filterLimit, constraints: filterConstraints } = filter ?? {};

      return prevQueryResult$.pipe(
        exhaustMap((prevResult) => {
          if (prevResult?.snapshot.empty === true) {
            // TODO: Shouldn't happen. Remove this later.
            return of<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>>({ end: true });
          } else {
            const constraints: FirestoreQueryConstraint[] = [];

            // Add filter constraints
            if (filterConstraints != null) {
              mergeIntoArray(constraints, filterDisallowedFirestoreItemPageIteratorInputContraints(asArray(filterConstraints)));
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
            const batchQuery = driver.query<T>(collection, ...constraintsWithLimit);
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

export class FirestoreItemPageIterationInstance<T> extends MappedPageItemIterationInstance<QueryDocumentSnapshotArray<T>, FirestoreItemPageQueryResult<T>, PageLoadingState<QueryDocumentSnapshotArray<T>>, PageLoadingState<FirestoreItemPageQueryResult<T>>, InternalFirestoreItemPageIterationInstance<T>> {
  constructor(snapshotIteration: InternalFirestoreItemPageIterationInstance<T>) {
    super(snapshotIteration, {
      forwardDestroy: true,
      mapValue: (x: FirestoreItemPageQueryResult<T>) => x.docs
    });
  }

  get snapshotIteration(): InternalFirestoreItemPageIterationInstance<T> {
    return this.itemIterator;
  }
}

// MARK: Iterator

/**
 * FirestoreItemPageIteration factory.
 */
export interface FirestoreItemPageIterationFactory<T> {
  readonly firestoreIteration: FirestoreItemPageIterationFactoryFunction<T>;
}

/**
 * Function that creates a FirestoreItemPageIterationInstance from the input filter.
 */
export type FirestoreItemPageIterationFactoryFunction<T> = (filter?: FirestoreItemPageIteratorFilter) => FirestoreItemPageIterationInstance<T>;

/**
 * Creates a new factory function that can build FirestoreItemPageIterationInstance values from just the input filter.
 *
 * @param baseConfig
 * @returns FirestoreItemPageIterationInstance
 */
export function firestoreItemPageIterationFactory<T>(baseConfig: FirestoreItemPageIterationBaseConfig<T>): FirestoreItemPageIterationFactoryFunction<T> {
  return (filter?: FirestoreItemPageIteratorFilter) => {
    const result: FirestoreItemPageIterationInstance<T> = firestoreItemPageIteration<T>({
      collection: baseConfig.collection,
      itemsPerPage: baseConfig.itemsPerPage,
      firestoreQueryDriver: baseConfig.firestoreQueryDriver,
      maxPageLoadLimit: filter?.maxPageLoadLimit ?? baseConfig.maxPageLoadLimit,
      filter
    });

    return result;
  };
}

export const FIRESTORE_ITEM_PAGE_ITERATOR_DELEGATE: FirestoreItemPageIteratorDelegate<unknown> = makeFirestoreItemPageIteratorDelegate();
export const FIRESTORE_ITEM_PAGE_ITERATOR = new ItemPageIterator<FirestoreItemPageQueryResult<unknown>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<unknown>>(FIRESTORE_ITEM_PAGE_ITERATOR_DELEGATE);

export function firestoreItemPageIteration<T>(config: FirestoreItemPageIterationConfig<T>): FirestoreItemPageIterationInstance<T> {
  const iterator: InternalFirestoreItemPageIterationInstance<T> = FIRESTORE_ITEM_PAGE_ITERATOR.instance(config) as InternalFirestoreItemPageIterationInstance<T>;
  return new FirestoreItemPageIterationInstance<T>(iterator);
}
