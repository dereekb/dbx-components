import { onSnapshot, DocumentReference, DocumentSnapshot, UpdateData, WithFieldValue, getDoc, deleteDoc, setDoc, updateDoc } from '@firebase/firestore';
import { Observable } from 'rxjs';
import { assertFirestoreUpdateHasData, DocumentData, FirestoreAccessorIncrementUpdate, FirestoreDataConverter, FirestoreDocumentContext, FirestoreDocumentContextType, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, SetOptions, streamFromOnSnapshot, WriteResult } from '../../common/firestore';
import { createWithAccessor } from './driver.accessor.create';
import { firestoreClientIncrementUpdateToUpdateData } from './increment';

// MARK: Accessor
export class DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  constructor(readonly documentRef: DocumentReference<T>) {}

  stream(): Observable<DocumentSnapshot<T>> {
    return streamFromOnSnapshot(({ next, error }) => onSnapshot(this.documentRef, next, error));
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

  increment(data: FirestoreAccessorIncrementUpdate<T>): Promise<void | WriteResult> {
    return this.update(firestoreClientIncrementUpdateToUpdateData(data));
  }

  update(data: UpdateData<object>): Promise<void> {
    assertFirestoreUpdateHasData(data);
    return updateDoc(this.documentRef, data as UpdateData<T>);
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
