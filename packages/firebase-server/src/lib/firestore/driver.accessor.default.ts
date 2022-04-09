import { DocumentReference, WriteResult as GoogleCloudWriteResult, DocumentSnapshot, UpdateData as GoogleCloudUpdateData } from "@google-cloud/firestore";
import { Observable } from "rxjs";
import { WithFieldValue, UpdateData, FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentDeleteParams, FirestoreDocumentUpdateParams, SetOptions, streamFromOnSnapshot, WriteResult } from "@dereekb/firebase";

// MARK: Accessor
export class DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {

  constructor(readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<DocumentSnapshot<T>> {
    return streamFromOnSnapshot(({ next, error }) => this.documentRef.onSnapshot(next, error));
  }

  exists(): Promise<boolean> {
    return this.get().then(x => x.exists);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.documentRef.get();
  }

  delete(params: FirestoreDocumentDeleteParams): Promise<GoogleCloudWriteResult> {
    return this.documentRef.delete(params?.precondition);
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<GoogleCloudWriteResult> {
    return this.documentRef.set(data as any, options as SetOptions);
  }

  update(data: UpdateData<T>, params?: FirestoreDocumentUpdateParams): Promise<GoogleCloudWriteResult> {
    return this.documentRef.update(data as any, params?.precondition ?? {});
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
  }
}
