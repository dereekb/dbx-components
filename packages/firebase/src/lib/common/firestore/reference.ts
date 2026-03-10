import { type FirestoreContext } from './context';
import { type CollectionReference, type DocumentReference, type Firestore, type FirestoreDataConverter, type Query, type Transaction } from './types';

/**
 * Holds a reference to a Firestore {@link Query}, which may be either a collection query
 * or a collection group query. Used as a base reference by collection groups and other
 * query-oriented interfaces.
 */
export interface QueryLikeReferenceRef<T> {
  readonly queryLike: Query<T>;
}

/**
 * Holds a reference to a {@link CollectionReference}.
 */
export interface CollectionReferenceRef<T> {
  readonly collection: CollectionReference<T>;
}

/**
 * Holds a reference to a {@link DocumentReference}.
 */
export interface DocumentReferenceRef<T> {
  readonly documentRef: DocumentReference<T>;
}

/**
 * Holds a reference to a {@link FirestoreContext} instance, providing access to
 * collection factories, transactions, and batch operations.
 */
export interface FirestoreContextReference<F extends Firestore = Firestore> {
  readonly firestoreContext: FirestoreContext<F>;
}

/**
 * Provides optional access to the current Firestore {@link Transaction}, if the
 * operation is running within a transaction context.
 */
export interface FirebaseTransactionContext {
  readonly transaction?: Transaction;
}

/**
 * Holds a reference to a {@link FirestoreDataConverter} for transforming data
 * between application models and Firestore document representations.
 */
export interface FirestoreDataConverterRef<U = unknown> {
  readonly converter: FirestoreDataConverter<U>;
}
