import { FirebaseTransactionContext, FirestoreCollectionLike, FirestoreDocument, FirestoreModelKey, LimitedFirestoreDocumentAccessor } from '../../firestore';
import { InContextModelLoader, ModelLoader } from '@dereekb/model';

export type FirebaseModelLoaderContext = FirebaseTransactionContext;

export type FirebaseModelGetFirestoreCollectionFunction<C extends FirebaseModelLoaderContext, T, D extends FirestoreDocument<T>> = (context: C) => FirestoreCollectionLike<T, D>;

export interface FirebaseModelCollectionLoader<C extends FirebaseModelLoaderContext, T, D extends FirestoreDocument<T>> {
  getFirestoreCollection: FirebaseModelGetFirestoreCollectionFunction<C, T, D>;
}

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

      const document = documentAccessor.loadDocumentForKey(key);
      return document;
    }
  };
}

// MARK: In Context
export interface InContextFirebaseModelLoader<T, D extends FirestoreDocument<T>> extends InContextModelLoader<D> {
  loadModelForKey(key: FirestoreModelKey): D;
}

/**
 * Type used to convert a FirebaseModelLoader into an InContextFirebaseModelLoader
 */
export type AsInContextFirebaseModelLoader<X> = X extends FirebaseModelLoader<infer C, infer T, infer D> ? InContextFirebaseModelLoader<T, D> : never;

// MARK: InModelContext
export interface InModelContextFirebaseModelLoader<T, D extends FirestoreDocument<T>> {
  readonly model: D;
}
