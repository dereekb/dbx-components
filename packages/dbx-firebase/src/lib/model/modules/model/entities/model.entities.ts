import { FirestoreDocument, FirestoreModelIdentity } from '@dereekb/firebase';
import { Maybe, ModelKey } from '@dereekb/util';
import { DbxFirebaseDocumentReadOnlyStore } from '../../store/store';
import { LoadingState } from '@dereekb/rxjs';
import { Observable } from 'rxjs';

/**
 * Provides a source of entities.
 */
export abstract class DbxFirebaseModelEntitiesSource {
  /**
   * Observable of a LoadingState of entity values.
   */
  abstract readonly entities$: Observable<LoadingState<DbxFirebaseModelEntity[]>>;
}

/**
 * A model entity.
 */
export interface DbxFirebaseModelEntity {
  /**
   * Model identity for the entity.
   *
   * Used for sorting/grouping by expected entity type.
   */
  readonly modelIdentity: FirestoreModelIdentity;
  /**
   * An associated store for the document, if it is available.
   */
  readonly store?: Maybe<DbxFirebaseDocumentReadOnlyStore<any, any>>;
}

export interface DbxFirebaseModelEntityWithStore<T = any, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends DbxFirebaseModelEntity {
  /**
   * An associated store for the document, if it is available.
   */
  readonly store: DbxFirebaseDocumentReadOnlyStore<T, D>;
}

/**
 * An entity that has a key.
 */
export interface DbxFirebaseModelEntityWithKey extends DbxFirebaseModelEntity {
  /**
   * The key of the target document.
   */
  readonly key: ModelKey;
}

/**
 * An entity that has a key and a store.
 */
export interface DbxFirebaseModelEntityWithKeyAndStore<T = any, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Omit<DbxFirebaseModelEntityWithKey, 'store'>, DbxFirebaseModelEntityWithStore<T, D> {}
