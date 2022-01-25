import { PageLoadingState } from './../../../../rxjs/src/lib/loading/loading.state';
import { Injectable } from '@angular/core';
import { ItemPageIterator, ItemPageIteratorIterationInstance, ItemPageIterationConfig, ItemPageIteratorDelegate, ItemPageIteratorRequest, ItemPageIteratorResult, PageItemIteration, MappedPageItemIterationInstance } from '@dereekb/rxjs';
import { QueryDocumentSnapshot, query, startAt, CollectionReference, getDocs, QueryConstraint, limit, QuerySnapshot } from '@angular/fire/firestore';
import { Maybe, lastValue, mergeIntoArray, Destroyable } from '@dereekb/util';
import { from, Observable, of } from "rxjs";
import { exhaustMap } from "rxjs/operators";

export interface FirestoreItemPageIteratorFilter {
  queryConstraints?: Maybe<QueryConstraint[]>;
}

export interface FirestoreItemPageIterationConfig<T> extends ItemPageIterationConfig<FirestoreItemPageIteratorFilter> {
  collection: CollectionReference<T>;
  itemsPerPage: number;
}

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
export type InternalFirestoreItemPageIteratorIterationInstance<T> = ItemPageIteratorIterationInstance<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>;

export function makeFirestoreItemPageIteratorDelegate<T>(): FirestoreItemPageIteratorDelegate<T> {
  return {
    loadItemsForPage: (request: ItemPageIteratorRequest<FirestoreItemPageQueryResult<T>, FirestoreItemPageIteratorFilter, FirestoreItemPageIterationConfig<T>>): Observable<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>> => {
      const { page, iteratorConfig } = request;
      const lastQueryResult$: Observable<Maybe<FirestoreItemPageQueryResult<T>>> = (page > 0) ? request.lastItem$ : of(undefined);

      const { collection, itemsPerPage, filter } = iteratorConfig;

      return lastQueryResult$.pipe(
        exhaustMap((lastResult) => {
          if (lastResult?.snapshot.empty === true) {  // TODO: Shouldn't happen. Remove this later.
            return of<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>>({ end: true });
          } else {
            const constraints: QueryConstraint[] = [];

            // Add filter constraints
            if (filter?.queryConstraints) {
              mergeIntoArray(constraints, filter.queryConstraints);
            }

            // Add cursor
            const cursorDocument = (lastResult) ? lastValue(lastResult.docs) : undefined;
            const startsAtFilter = (cursorDocument) ? startAt(cursorDocument) : undefined;

            if (startsAtFilter) {
              constraints.push(startsAtFilter);
            }

            // Add Limit
            constraints.push(limit(itemsPerPage + ((startsAtFilter) ? 1 : 0)));   // Add 1 for cursor, since results will start at our cursor.

            const batchQuery = query<T>(collection, ...constraints);
            const resultPromise: Promise<ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>> = getDocs(batchQuery).then((snapshot) => {
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

export const FIRESTORE_ITEM_PAGE_ITERATOR_DELEGATE: FirestoreItemPageIteratorDelegate<any> = makeFirestoreItemPageIteratorDelegate() as any;

/**
 * Base iterator service used to generate FirestoreItemPageIteratorIterationInstances.
 */
@Injectable()
export class FirestoreItemPageIterator<T> {

  private readonly _itemPageIterator = new ItemPageIterator<
    FirestoreItemPageQueryResult<T>,
    FirestoreItemPageIteratorFilter,
    FirestoreItemPageIterationConfig<T>
  >(FIRESTORE_ITEM_PAGE_ITERATOR_DELEGATE);

  instance<T>(config: FirestoreItemPageIterationConfig<T>): FirestoreItemPageIteratorIterationInstance<T> {
    // TODO: as any typings provided since angularfire has a rough time with collection typings sometimes.
    // https://github.com/angular/angularfire/issues/2931
    const iterator: InternalFirestoreItemPageIteratorIterationInstance<T> = this._itemPageIterator.instance(config as any) as any;
    return new FirestoreItemPageIteratorIterationInstance<T>(iterator);
  }

}

export class FirestoreItemPageIteratorIterationInstance<T> extends MappedPageItemIterationInstance<
  QueryDocumentSnapshot<T>[],
  FirestoreItemPageQueryResult<T>,
  PageLoadingState<QueryDocumentSnapshot<T>[]>,
  PageLoadingState<FirestoreItemPageQueryResult<T>>,
  InternalFirestoreItemPageIteratorIterationInstance<T>
> {

  constructor(snapshotIteration: InternalFirestoreItemPageIteratorIterationInstance<T>) {
    super(snapshotIteration, {
      forwardDestroy: true,
      mapValue: (x: FirestoreItemPageQueryResult<T>) => x.docs
    });
  }

  get snapshotIteration(): InternalFirestoreItemPageIteratorIterationInstance<T> {
    return this.itemIterator;
  }

}
