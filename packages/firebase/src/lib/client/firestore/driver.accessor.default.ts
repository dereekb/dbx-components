import { DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue, getDoc, deleteDoc, setDoc, updateDoc } from "@firebase/firestore";
import { fromRef } from "rxfire/firestore";
import { Observable } from "rxjs";
import { FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, SetOptions } from "../../common/firestore";

// MARK: Accessor
export class DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {

  constructor(readonly documentRef: DocumentReference<T>) { }

  stream(): Observable<DocumentSnapshot<T>> {
    return fromRef(this.documentRef);
  }

  exists(): Promise<boolean> {
    return this.get().then(x => x.exists());
  }

  get(): Promise<DocumentSnapshot<T>> {
    return getDoc(this.documentRef);
  }

  delete(): Promise<void> {
    return deleteDoc(this.documentRef);
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<void> {
    return setDoc(this.documentRef, data, options as SetOptions);
  }

  update(data: UpdateData<T>): Promise<void> {
    return updateDoc(this.documentRef, data);
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
