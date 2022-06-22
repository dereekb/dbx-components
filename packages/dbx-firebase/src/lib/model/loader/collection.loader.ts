import { DocumentDataWithId, FirestoreItemPageIterationInstance, FirestoreQueryConstraint, IterationQueryDocChangeWatcher } from '@dereekb/firebase';
import { PageListLoadingState } from '@dereekb/rxjs';
import { Maybe, ArrayOrValue } from '@dereekb/util';
import { Observable } from 'rxjs';

export interface DbxFirebaseCollectionLoaderAccessor<T = unknown> {
  readonly constraints$: Observable<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>;
  readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>>;
  readonly pageLoadingState$: Observable<PageListLoadingState<DocumentDataWithId<T>>>;
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
}
