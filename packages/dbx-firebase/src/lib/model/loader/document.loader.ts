import { DocumentDataWithId, FirestoreModelKey, DocumentReference, FirestoreDocument, FirestoreModelId, DocumentSnapshot } from '@dereekb/firebase';
import { ObservableOrValue, PageListLoadingState } from '@dereekb/rxjs';
import { Maybe, ArrayOrValue } from '@dereekb/util';
import { Observable } from 'rxjs';

/**
 * Abstract type that loads document snapshots from keys, refs, or documents.
 */
export interface DbxLimitedFirebaseDocumentLoader<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  /**
   * Keys of the documents
   */
  readonly keys$: Observable<FirestoreModelKey[]>;

  /**
   * Refs of the documents
   */
  readonly refs$: Observable<DocumentReference<T>[]>;

  /**
   * Ids of the documents
   */
  readonly ids$: Observable<FirestoreModelId[]>;

  /**
   * Documents to load.
   */
  readonly documents$: Observable<D[]>;

  /**
   * Snapshots of the documents
   */
  readonly snapshots$: Observable<DocumentSnapshot<T>[]>;

  /**
   * Data from the documents.
   */
  readonly data$: Observable<DocumentDataWithId<T>[]>;

  /**
   * Loading state for the document data.
   */
  readonly pageLoadingState$: Observable<PageListLoadingState<DocumentDataWithId<T>>>;

  /**
   * Sets the keys of the models to load.
   *
   * @param constraints
   */
  setKeys(keys: Maybe<ObservableOrValue<ArrayOrValue<FirestoreModelKey>>>): void;

  /**
   * Sets the document references to load.
   *
   * @param constraints
   */
  setRefs(refs: Maybe<ObservableOrValue<ArrayOrValue<DocumentReference<T>>>>): void;

  /**
   * Sets the documents to load from.
   *
   * @param constraints
   */
  setDocuments(docs: Maybe<ObservableOrValue<ArrayOrValue<D>>>): void;
}

export interface DbxFirebaseDocumentLoader<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends DbxLimitedFirebaseDocumentLoader<T, D> {
  /**
   * Sets the ids of the models to load.
   *
   * @param constraints
   */
  setIds(ids: Maybe<ObservableOrValue<ArrayOrValue<FirestoreModelId>>>): void;
}
