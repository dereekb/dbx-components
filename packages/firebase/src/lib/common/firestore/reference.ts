import { type FirestoreContext } from './context';
import { type CollectionReference, type DocumentReference, type Firestore, type FirestoreDataConverter, type Query, type Transaction } from './types';

/**
 * Contains a reference to a Query.
 */
export interface QueryLikeReferenceRef<T> {
  readonly queryLike: Query<T>;
}

/**
 * Contains a reference to a CollectionReference.
 */
export interface CollectionReferenceRef<T> {
  readonly collection: CollectionReference<T>;
}

/**
 * Contains a reference to a DocumentReference.
 */
export interface DocumentReferenceRef<T> {
  readonly documentRef: DocumentReference<T>;
}

/**
 * Contains a reference to a FirestoreContext.
 */
export interface FirestoreContextReference<F extends Firestore = Firestore> {
  readonly firestoreContext: FirestoreContext<F>;
}

/**
 * Contains contextual information about the current Transaction, if available.
 */
export interface FirebaseTransactionContext {
  readonly transaction?: Transaction;
}

/**
 * Contains contextual information about the current Transaction, if available.
 */
export interface FirestoreDataConverterRef<U = unknown> {
  readonly converter: FirestoreDataConverter<U>;
}
