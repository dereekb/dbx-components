import { type DocumentReference, type WriteResult as GoogleCloudWriteResult, type DocumentSnapshot } from '@google-cloud/firestore';
import { type Observable } from 'rxjs';
import { type WithFieldValue, type UpdateData, type FirestoreDocumentContext, FirestoreDocumentContextType, type FirestoreDocumentDataAccessor, type FirestoreDocumentDataAccessorFactory, type FirestoreDocumentDeleteParams, type FirestoreDocumentUpdateParams, type SetOptions, streamFromOnSnapshot, type FirestoreDataConverter, type DocumentData, type FirestoreAccessorIncrementUpdate, type FirestoreAccessorArrayUpdate } from '@dereekb/firebase';
import { firestoreServerIncrementUpdateToUpdateData } from './increment';
import { firestoreServerArrayUpdateToUpdateData } from './array';

// MARK: Accessor
/**
 * Default Google Cloud Firestore implementation of {@link FirestoreDocumentDataAccessor}.
 *
 * Performs all operations directly against the Firestore document reference without
 * batching or transactional context. Supports real-time streaming via `onSnapshot`.
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

  getWithConverter<U = DocumentData>(converter: null | FirestoreDataConverter<U>): Promise<DocumentSnapshot<U>> {
    return this.documentRef.withConverter<U>(converter as FirestoreDataConverter<U>).get();
  }

  delete(params?: FirestoreDocumentDeleteParams): Promise<GoogleCloudWriteResult> {
    return this.documentRef.delete(params?.precondition);
  }

  set(data: WithFieldValue<T>, options?: SetOptions): Promise<GoogleCloudWriteResult> {
    return options ? this.documentRef.set(data as Partial<T>, options) : this.documentRef.set(data as T);
  }

  increment(data: FirestoreAccessorIncrementUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<GoogleCloudWriteResult> {
    return this.update(firestoreServerIncrementUpdateToUpdateData(data), params);
  }

  arrayUpdate(data: FirestoreAccessorArrayUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<GoogleCloudWriteResult> {
    return this.update(firestoreServerArrayUpdateToUpdateData(data), params);
  }

  update(data: UpdateData<object>, params?: FirestoreDocumentUpdateParams): Promise<GoogleCloudWriteResult> {
    return params?.precondition ? this.documentRef.update(data as FirebaseFirestore.UpdateData<DocumentData>, params.precondition) : this.documentRef.update(data as FirebaseFirestore.UpdateData<DocumentData>);
  }
}

/**
 * Creates a {@link FirestoreDocumentDataAccessorFactory} that produces default (non-batched, non-transactional) accessors.
 *
 * @returns A factory that creates default (non-batched, non-transactional) accessors.
 *
 * @example
 * ```typescript
 * const factory = defaultFirestoreAccessorFactory<User>();
 * const accessor = factory.accessorFor(userDocRef);
 * ```
 */
export function defaultFirestoreAccessorFactory<T>(): FirestoreDocumentDataAccessorFactory<T> {
  return {
    accessorFor: (ref: DocumentReference<T>) => new DefaultFirestoreDocumentDataAccessor(ref)
  };
}

// MARK: Context
/**
 * Creates a {@link FirestoreDocumentContext} with no special execution context (no batch, no transaction).
 *
 * Operations performed through this context execute immediately against Firestore.
 *
 * @returns A {@link FirestoreDocumentContext} for direct Firestore operations.
 */
export function defaultFirestoreDocumentContext<T>(): FirestoreDocumentContext<T> {
  return {
    contextType: FirestoreDocumentContextType.NONE,
    accessorFactory: defaultFirestoreAccessorFactory<T>()
  };
}
