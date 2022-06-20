import { DocumentDataWithId, FirestoreItemPageIterationInstance, FirestoreQueryConstraint } from '@dereekb/firebase';
import { PageListLoadingState } from '@dereekb/rxjs';
import { Maybe, ArrayOrValue } from '@dereekb/util';
import { Observable } from 'rxjs';

/**
 * Abstract type that loads models from a configured collection.
 */
export interface DbxFirebaseCollectionLoader<T = unknown> {
  readonly constraints$: Observable<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>;
  readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>>;
  readonly pageLoadingState$: Observable<PageListLoadingState<DocumentDataWithId<T>>>;

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

  /**
   * Resets/restarts the list.
   */
  restart(): void;
}
