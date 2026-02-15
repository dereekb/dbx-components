import { type FirestoreDocument, type FirestoreModelIdentity } from '@dereekb/firebase';
import { type Maybe, type ModelKey } from '@dereekb/util';
import { type DbxFirebaseDocumentReadOnlyStore } from '../../store/store';
import { type LoadingState } from '@dereekb/rxjs';
import { type Observable } from 'rxjs';

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
   * Optional name for
   */
  readonly name?: Maybe<string>;
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
 * Returns true if the input entity has a defined store.
 *
 * @param entity
 * @returns
 */
export function isDbxFirebaseModelEntityWithStore<T = any, D extends FirestoreDocument<T> = FirestoreDocument<T>>(entity: DbxFirebaseModelEntity): entity is DbxFirebaseModelEntityWithStore<T, D> {
  return entity.modelIdentity != null && entity.store != null;
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
