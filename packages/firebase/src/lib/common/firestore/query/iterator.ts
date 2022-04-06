import { PageLoadingState, ItemPageIterator, ItemPageIterationInstance, ItemPageIterationConfig, ItemPageIteratorDelegate, ItemPageIteratorRequest, ItemPageIteratorResult, MappedPageItemIterationInstance } from '@dereekb/rxjs';
import { QueryDocumentSnapshot, QuerySnapshot } from "../types";
import { asArray, Maybe, lastValue, mergeIntoArray, ArrayOrValue } from '@dereekb/util';
import { from, Observable, of, exhaustMap } from "rxjs";
import { CollectionReferenceRef } from '../reference';
import { FirestoreQueryDriverRef } from '../driver/query';
import { FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, FirestoreQueryConstraint, limit, startAfter } from './constraint';

export interface FirestoreItemPageIteratorFilter {
  /**
   * Overrides the default limit, if applicable.
   */
  limit?: number;
  /**
   * Constraints to query on.
   */
  constraints?: Maybe<ArrayOrValue<FirestoreQueryConstraint>>;
}

export interface FirestoreItemPageIterationBaseConfig<T> extends CollectionReferenceRef<T>, FirestoreQueryDriverRef {
  itemsPerPage: number;
}

export interface FirestoreItemPageIterationConfig<T> extends FirestoreItemPageIterationBaseConfig<T>, ItemPageIterationConfig<FirestoreItemPageIteratorFilter> { }

export interface FirestoreItemPageQueryResult<T> {
  /**
   * The relevant docs for this page result. This value will omit the cursor.
   */
  docs: QueryDocumentSnapshot<T>[];
  /**
   * The raw snapshot returned from the query.
   */
  snapshot: QuerySnapshot<T>;
}

export type FirestoreItemPageIteratorDelegate<T> = ItemPageIteratorDelegate<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>;
export type InternalFirestoreItemPageIterationInstance<T> = ItemPageIterationInstance<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>;

export function filterDisallowedFirestoreItemPageIteratorInputContraints(constraints: FirestoreQueryConstraint[]): FirestoreQueryConstraint[] {
  const isIllegal = new Set([FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]);
  return constraints.filter(x => !isIllegal.has(x.type));
}

export function makeFirestoreItemPageIteratorDelegate<T>(): FirestoreItemPageIteratorDelegate<T> {
  return {
    loadItemsForPage: (request: ItemPageIteratorRequest<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>): Observable<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>> => {
      const { page, iteratorConfig } = request;
      const lastQueryResult$: Observable<Maybe<FirestoreItemPageQueryResult<T>>> = (page > 0) ? request.lastItem$ : of(undefined);

      const { collection, itemsPerPage, filter, firestoreQueryDriver: driver } = iteratorConfig;
      const { limit: filterLimit, constraints: filterConstraints } = filter ?? {};

      return lastQueryResult$.pipe(
        exhaustMap((lastResult) => {
          if (lastResult?.snapshot.empty === true) {  // TODO: Shouldn't happen. Remove this later.
            return of<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>>({ end: true });
          } else {
            const constraints: FirestoreQueryConstraint[] = [];

            // Add filter constraints
            if (filterConstraints != null) {
              mergeIntoArray(constraints, filterDisallowedFirestoreItemPageIteratorInputContraints(asArray(filterConstraints)));
            }

            // Add cursor
            const cursorDocument = (lastResult) ? lastValue(lastResult.docs) : undefined;
            const startAfterFilter = (cursorDocument) ? startAfter(cursorDocument) : undefined;

            if (startAfterFilter) {
              constraints.push(startAfterFilter);
            }

            // Add Limit
            const limitCount = filter?.limit ?? itemsPerPage + ((startAfterFilter) ? 1 : 0);
            constraints.push(limit(limitCount));   // Add 1 for cursor, since results will start at our cursor.

            const batchQuery = driver.query<T>(collection, ...constraints);
            const resultPromise: Promise<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>> = driver.getDocs(batchQuery).then((snapshot) => {
              let docs = snapshot.docs;

              // Remove the cursor document from the results.
              if (cursorDocument && docs[0].id === cursorDocument.id) {
                docs = docs.slice(1);
              }

              const result: ItemPageIteratorResult<FirestoreItemPageQueryResult<T>> = {
                value: {
                  docs,
                  snapshot
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
  }
}

export class FirestoreItemPageIterationInstance<T> extends MappedPageItemIterationInstance<
  QueryDocumentSnapshot<T>[],
  FirestoreItemPageQueryResult<T>,
  PageLoadingState<QueryDocumentSnapshot<T>[]>,
  PageLoadingState<FirestoreItemPageQueryResult<T>>,
  InternalFirestoreItemPageIterationInstance<T>
> {

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
      filter
    });

    return result;
  };
}

export const FIRESTORE_ITEM_PAGE_ITERATOR_DELEGATE: FirestoreItemPageIteratorDelegate<any> = makeFirestoreItemPageIteratorDelegate() as any;
export const FIRESTORE_ITEM_PAGE_ITERATOR = new ItemPageIterator<FirestoreItemPageQueryResult<any>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<any>>(FIRESTORE_ITEM_PAGE_ITERATOR_DELEGATE);

export function firestoreItemPageIteration<T>(config: FirestoreItemPageIterationConfig<T>): FirestoreItemPageIterationInstance<T> {
  const iterator: InternalFirestoreItemPageIterationInstance<T> = FIRESTORE_ITEM_PAGE_ITERATOR.instance(config);
  return new FirestoreItemPageIterationInstance<T>(iterator);
}
