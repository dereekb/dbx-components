import { onSnapshot, type DocumentReference, type DocumentSnapshot, type UpdateData, type WithFieldValue, getDoc, deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { type Observable } from 'rxjs';
import { assertFirestoreUpdateHasData, type DocumentData, type FirestoreAccessorArrayUpdate, type FirestoreAccessorIncrementUpdate, type FirestoreDataConverter, type FirestoreDocumentContext, FirestoreDocumentContextType, type FirestoreDocumentDataAccessor, type FirestoreDocumentDataAccessorFactory, type SetOptions, streamFromOnSnapshot, type WriteResult } from '../../common/firestore';
import { createWithAccessor } from './driver.accessor.create';
import { firestoreClientIncrementUpdateToUpdateData } from './increment';
import { firestoreClientArrayUpdateToUpdateData } from './array';

// MARK: Accessor
/**
 * Default (non-transactional) client-side implementation of {@link FirestoreDocumentDataAccessor}.
 *
 * Wraps a single Firestore `DocumentReference` and provides CRUD operations, streaming,
 * and field-level updates (increment, array union/remove) using the `firebase/firestore` SDK.
 *
 * Used as the base accessor class; {@link WriteBatchFirestoreDocumentDataAccessor} extends this
 * to add batch write semantics.
 */
export class DefaultFirestoreDocumentDataAccessor<T> implements FirestoreDocumentDataAccessor<T> {
  private readonly _documentRef: DocumentReference<T>;

  constructor(documentRef: DocumentReference<T>) {
    this._documentRef = documentRef;
  }

  get documentRef(): DocumentReference<T> {
    return this._documentRef;
  }

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
    const withConverter = (converter != null ? this.documentRef.withConverter<U, DocumentData>(converter) : this.documentRef.withConverter(null)) as DocumentReference<U, DocumentData>;
    return getDoc(withConverter) as Promise<DocumentSnapshot<U>>;
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

  arrayUpdate(data: FirestoreAccessorArrayUpdate<T>): Promise<void | WriteResult> {
    return this.update(firestoreClientArrayUpdateToUpdateData(data));
  }

  update(data: UpdateData<object>): Promise<void> {
    assertFirestoreUpdateHasData(data);
    return updateDoc(this.documentRef, data);
  }
}

/**
 * Creates a {@link FirestoreDocumentDataAccessorFactory} that produces {@link DefaultFirestoreDocumentDataAccessor} instances
 * for direct (non-batched, non-transactional) Firestore operations.
 *
 * @returns a factory that creates default (non-transactional) document data accessors
 *
 * @example
 * ```ts
 * const factory = defaultFirestoreAccessorFactory<MyModel>();
 * const accessor = factory.accessorFor(documentRef);
 * const snapshot = await accessor.get();
 * ```
 */
export function defaultFirestoreAccessorFactory<T>(): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new DefaultFirestoreDocumentDataAccessor(ref)
  };
}

// MARK: Context
/**
 * Creates a default (non-transactional, non-batched) {@link FirestoreDocumentContext} for client-side use.
 *
 * The context type is {@link FirestoreDocumentContextType.NONE}, meaning operations execute immediately
 * against Firestore without transaction or batch grouping.
 *
 * @returns a default {@link FirestoreDocumentContext} with no transaction or batch semantics
 *
 * @example
 * ```ts
 * const context = defaultFirestoreDocumentContext<MyModel>();
 * const accessor = context.accessorFactory.accessorFor(docRef);
 * ```
 */
export function defaultFirestoreDocumentContext<T>(): FirestoreDocumentContext<T> {
  return {
    contextType: FirestoreDocumentContextType.NONE,
    accessorFactory: defaultFirestoreAccessorFactory<T>()
  };
}
