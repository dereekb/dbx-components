import { type FirebaseTransactionContext, type FirestoreCollectionLike, type FirestoreDocument, type FirestoreModelKey, type LimitedFirestoreDocumentAccessor } from '../../firestore';
import { type InContextModelLoader, type ModelLoader } from '@dereekb/model';
import { type Getter } from '@dereekb/util';

/**
 * Context type for model loading operations — requires optional transaction support.
 */
export type FirebaseModelLoaderContext = FirebaseTransactionContext;

/**
 * Function that retrieves a {@link FirestoreCollectionLike} from a context, used by loaders to access the correct collection.
 */
export type FirebaseModelGetFirestoreCollectionFunction<C extends FirebaseModelLoaderContext, T, D extends FirestoreDocument<T>> = (context: C) => FirestoreCollectionLike<T, D>;

/**
 * Provides access to a Firestore collection for a specific model type within a given context.
 */
export interface FirebaseModelCollectionLoader<C extends FirebaseModelLoaderContext, T, D extends FirestoreDocument<T>> {
  readonly getFirestoreCollection: FirebaseModelGetFirestoreCollectionFunction<C, T, D>;
}

/**
 * Loads a {@link FirestoreDocument} wrapper for a given model key and context.
 *
 * Does not verify that the document actually exists in Firestore — it creates a document reference
 * that can then be used for reads, writes, or permission checks.
 */
export interface FirebaseModelLoader<C extends FirebaseModelLoaderContext, T, D extends FirestoreDocument<T>> extends ModelLoader<C, D> {
  /**
   * Loads a FirestoreDocument for the input key.
   *
   * Does not check existence of data on the model.
   *
   * @param key
   * @param context
   */
  loadModelForKey(key: FirestoreModelKey, context: C): D;
}

/**
 * Creates a {@link FirebaseModelLoader} that loads document wrappers from the given collection function.
 *
 * Automatically uses a transaction accessor when the context has an active transaction.
 *
 * @param getFirestoreCollection - function to retrieve the Firestore collection from context
 * @returns a {@link FirebaseModelLoader} that loads document wrappers for given keys
 *
 * @example
 * ```ts
 * const loader = firebaseModelLoader((ctx) => ctx.app.notifications);
 * const doc = loader.loadModelForKey('notifications/abc123', context);
 * ```
 */
export function firebaseModelLoader<C extends FirebaseModelLoaderContext, T, D extends FirestoreDocument<T>>(getFirestoreCollection: FirebaseModelGetFirestoreCollectionFunction<C, T, D>): FirebaseModelLoader<C, T, D> {
  return {
    loadModelForKey(key: FirestoreModelKey, context: C): D {
      const firestoreCollection = getFirestoreCollection(context);
      let documentAccessor: LimitedFirestoreDocumentAccessor<T, D>;

      if (context.transaction) {
        documentAccessor = firestoreCollection.documentAccessorForTransaction(context.transaction);
      } else {
        documentAccessor = firestoreCollection.documentAccessor();
      }

      return documentAccessor.loadDocumentForKey(key);
    }
  };
}

// MARK: In Context
/**
 * Context-bound variant of {@link FirebaseModelCollectionLoader} — the context is already captured.
 */
export interface InContextFirebaseModelCollectionLoader<T, D extends FirestoreDocument<T>> {
  readonly getFirestoreCollection: Getter<FirestoreCollectionLike<T, D>>;
}

/**
 * Context-bound variant of {@link FirebaseModelLoader} — the context is already captured.
 */
export interface InContextFirebaseModelLoader<T, D extends FirestoreDocument<T>> extends InContextModelLoader<D> {
  loadModelForKey(key: FirestoreModelKey): D;
}

/**
 * Type used to convert a FirebaseModelLoader into an InContextFirebaseModelLoader
 */
export type AsInContextFirebaseModelLoader<X> = X extends FirebaseModelLoader<infer C, infer T, infer D> ? InContextFirebaseModelLoader<T, D> : never;

// MARK: InModelContext
/**
 * A loader that is already bound to a specific model document instance.
 */
export interface InModelContextFirebaseModelLoader<T, D extends FirestoreDocument<T>> {
  readonly model: D;
}
