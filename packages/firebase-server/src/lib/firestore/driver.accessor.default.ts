import { DocumentReference, WriteResult as GoogleCloudWriteResult, DocumentSnapshot } from '@google-cloud/firestore';
import { Observable } from 'rxjs';
import { WithFieldValue, UpdateData, FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentDeleteParams, FirestoreDocumentUpdateParams, SetOptions, streamFromOnSnapshot } from '@dereekb/firebase';

// MARK: Accessor
export class DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  constructor(readonly documentRef: DocumentReference<T>) {}

  stream(): Observable<DocumentSnapshot<T>> {
    return streamFromOnSnapshot(({ next, error }) => this.documentRef.onSnapshot(next, error));
  }

  create(data: T): Promise<GoogleCloudWriteResult> {
    return this.documentRef.create(data);
  }

  exists(): Promise<boolean> {
    return this.get().then((x) => x.exists);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.documentRef.get();
  }

  delete(params: FirestoreDocumentDeleteParams): Promise<GoogleCloudWriteResult> {
    return this.documentRef.delete(params?.precondition);
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<GoogleCloudWriteResult> {
    return options ? this.documentRef.set(data as Partial<T>, options) : this.documentRef.set(data as T);
  }

  update(data: UpdateData<T>, params?: FirestoreDocumentUpdateParams): Promise<GoogleCloudWriteResult> {
    return this.documentRef.update(data as FirebaseFirestore.UpdateData, params?.precondition ?? {});
  }
}

export function defaultFirestoreAccessorFactory<T>(): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new DefaultFirestoreDocumentDataAccessor(ref)
  };
}

// MARK: Context
export function defaultFirestoreDocumentContext<T>(): FirestoreDocumentContext<T> {
  return {
    contextType: FirestoreDocumentContextType.NONE,
    accessorFactory: defaultFirestoreAccessorFactory<T>()
  };
}
