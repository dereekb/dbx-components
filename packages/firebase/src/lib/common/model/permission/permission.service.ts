import { DocumentSnapshot, FirestoreCollection, FirestoreCollectionLike, FirestoreDocument, FirestoreDocumentAccessor, LimitedFirestoreDocumentAccessor } from './../../firestore';
import { AbstractModelPermissionService, ModelPermissionService } from '@dereekb/model';
import { Maybe, ModelKey, ModelTypeString } from '@dereekb/util';
import { FirebasePermissionContext } from './permission.context';

export interface FirebasePermissionServiceModel<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly document: D;
  readonly snapshot: DocumentSnapshot<T>;
  readonly data: T;
}

/**
 * Permission service for Firebase models.
 */
export interface FirebaseModelsPermissionService<C extends FirebasePermissionContext> {
  modelPermissions<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string, O = T>(type: ModelTypeString): ModelPermissionService<D, C, R, O>;
}

/**
 * Abstract AbstractModelPermissionService implementation for FirebaseModelsPermissionService.
 */
export abstract class AbstractFirebasePermissionService<T, C extends FirebasePermissionContext, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends AbstractModelPermissionService<D, C, R, FirebasePermissionServiceModel<T, D>> implements ModelPermissionService<D, C, R, FirebasePermissionServiceModel<T, D>> {
  protected loadModelForKey(key: ModelKey, context: C): D {
    const firestoreCollection = this.getFirestoreCollection(context);
    let documentAccessor: LimitedFirestoreDocumentAccessor<T, D>;

    if (context.transaction) {
      documentAccessor = firestoreCollection.documentAccessorForTransaction(context.transaction);
    } else {
      documentAccessor = firestoreCollection.documentAccessor();
    }

    const document = documentAccessor.loadDocumentForKey(key);
    return document;
  }

  protected async outputForModel(document: D, context: C): Promise<Maybe<FirebasePermissionServiceModel<T, D>>> {
    const snapshot = await document.accessor.get();
    const data = snapshot.data();

    const model: Maybe<FirebasePermissionServiceModel<T, D>> = data != null ? { document, snapshot, data } : undefined;
    return model;
  }

  protected abstract getFirestoreCollection(context: C): FirestoreCollectionLike<T, D>;
}
