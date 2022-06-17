import { DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue, getDoc, deleteDoc, setDoc, updateDoc } from '@firebase/firestore';
import { fromRef } from 'rxfire/firestore';
import { Observable } from 'rxjs';
import { DocumentData, FirestoreDataConverter, FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, SetOptions } from '../../common/firestore';
import { createWithAccessor } from './driver.accessor.create';

// MARK: Accessor
export class DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  constructor(readonly documentRef: DocumentReference<T>) {}

  stream(): Observable<DocumentSnapshot<T>> {
    return fromRef(this.documentRef);
  }

  create(data: WithFieldValue<T>): Promise<void> {
    return createWithAccessor(this)(data) as Promise<void>;
  }

  exists(): Promise<boolean> {
    return this.get().then((x) => x.exists());
  }

  get(): Promise<DocumentSnapshot<T>> {
    return getDoc(this.documentRef);
  }

  getWithConverter<U = DocumentData>(converter: null | FirestoreDataConverter<U>): Promise<DocumentSnapshot<U>> {
    return getDoc(this.documentRef.withConverter<U>(converter as FirestoreDataConverter<U>)) as Promise<DocumentSnapshot<U>>;
  }

  delete(): Promise<void> {
    return deleteDoc(this.documentRef);
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<void> {
    return setDoc(this.documentRef, data, options as SetOptions);
  }

  update(data: UpdateData<unknown>): Promise<void> {
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
  };
}
