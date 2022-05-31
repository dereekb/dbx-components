import { FirebaseTransactionContext, FirestoreCollectionLike, FirestoreDocument, LimitedFirestoreDocumentAccessor } from '../../firestore';
import { ModelLoader } from '@dereekb/model';
import { ModelKey } from '@dereekb/util';

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
  loadModelForKey(key: ModelKey, context: C): D;
}

export function firebaseModelLoader<C extends FirebaseModelLoaderContext, T, D extends FirestoreDocument<T>>(getFirestoreCollection: FirebaseModelGetFirestoreCollectionFunction<C, T, D>): FirebaseModelLoader<C, T, D> {
  return {
    loadModelForKey(key: ModelKey, context: C): D {
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
