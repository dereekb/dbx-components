import { DocumentReference, DocumentSnapshot, WriteResult, UpdateData as GoogleCloudUpdateData } from "@google-cloud/firestore";
import { from, Observable } from "rxjs";
import { WithFieldValue, UpdateData, FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentDeleteParams, FirestoreDocumentUpdateParams, SetOptions } from "@dereekb/firebase";

// MARK: Accessor
export class DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {

  constructor(readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<DocumentSnapshot<T>> {
    return from(this.get());  // todo
  }

  exists(): Promise<boolean> {
    return this.get().then(x => x.exists);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.documentRef.get();
  }

  delete(params: FirestoreDocumentDeleteParams): Promise<WriteResult> {
    return this.documentRef.delete(params?.precondition);
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<WriteResult> {
    return this.documentRef.set(data as any, options as SetOptions);
  }

  update(data: UpdateData<T>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult> {
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
