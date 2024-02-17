import { DocumentDataWithIdAndKey, FirebaseQueryItemAccumulator, FirebaseQueryItemAccumulatorNextPageUntilResultsCountFunction, FirebaseQuerySnapshotAccumulator, FirestoreItemPageIterationInstance, FirestoreQueryConstraint, IterationQueryDocChangeWatcher } from '@dereekb/firebase';
import { ItemAccumulatorNextPageUntilResultsCountFunction, ItemAccumulatorNextPageUntilResultsCountResult, PageListLoadingState } from '@dereekb/rxjs';
import { Maybe, ArrayOrValue, PageNumber } from '@dereekb/util';
import { Observable } from 'rxjs';

export interface DbxFirebaseCollectionLoaderAccessor<T = unknown> {
  readonly constraints$: Observable<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>;
  readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>>;
  readonly pageLoadingState$: Observable<PageListLoadingState<DocumentDataWithIdAndKey<T>>>;
  readonly queryChangeWatcher$: Observable<IterationQueryDocChangeWatcher<T>>;

  /**
   * Restarts the loader and refreshes items from the beginning.
   */
  restart(): void;
}

/**
 * Abstract type that loads models from a configured collection.
 */
export interface DbxFirebaseCollectionLoader<T = unknown> extends DbxFirebaseCollectionLoaderAccessor<T> {
  /**
   * Maximum number of pages to load from the interation.
   *
   * Changing this updates the iteration, but does not reset it.
   */
  maxPages: Maybe<number>;

  /**
   * Number of items to load per page.
   *
   * Changing this will reset the iteration.
   */
  itemsPerPage: Maybe<number>;

  /**
   * Sets the constraints on the model loader.
   *
   * @param constraints
   */
  setConstraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>): void;

  /**
   * Loads more items.
   */
  next(): void;

  // MARK: Utility Functions
  /**
   * Returns an observable that loads up to the given page then emits the page number.
   *
   * @param page Page number to load to.
   */
  loadToPage(page: PageNumber): Observable<PageNumber>;

  /**
   * Loads results until all results have been loaded or the max page limit is reached.
   */
  loadAllResults(): Observable<PageNumber>;
}

// MARK: Accumulator
export interface DbxFirebaseCollectionLoaderAccessorWithAccumulator<T = unknown> extends DbxFirebaseCollectionLoaderAccessor<T> {
  readonly snapshotAccumulator$: Observable<FirebaseQuerySnapshotAccumulator<T>>;
  readonly accumulator$: Observable<FirebaseQueryItemAccumulator<T>>;
}

export interface DbxFirebaseCollectionLoaderWithAccumulator<T = unknown> extends DbxFirebaseCollectionLoader<T>, DbxFirebaseCollectionLoaderAccessorWithAccumulator<T> {
  /**
   * Loads pages until the number of results has been reached, then emits the total number of results.
   */
  loadPagesUntilResultsCount(maxResultsCount: number, countFunction?: FirebaseQueryItemAccumulatorNextPageUntilResultsCountFunction<T>): Observable<ItemAccumulatorNextPageUntilResultsCountResult>;
}
