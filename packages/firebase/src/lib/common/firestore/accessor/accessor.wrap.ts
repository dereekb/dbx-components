import { Observable } from 'rxjs';
import { DocumentData, DocumentReference, DocumentSnapshot, PartialWithFieldValue, SetOptions, UpdateData, WithFieldValue, WriteResult } from '../types';
import { FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory, FirestoreDocumentDeleteParams, FirestoreDocumentUpdateParams } from './accessor';

// MARK: Abstract Wrapper
/**
 * Abstract wrapper for a FirestoreDocumentDataAccessor.
 *
 * Forwards all non-overridden accessor functions to the wrapped accessor by default.
 */
export abstract class AbstractFirestoreDocumentDataAccessorWrapper<T, D = DocumentData> implements FirestoreDocumentDataAccessor<T, D> {
  constructor(readonly accessor: FirestoreDocumentDataAccessor<T, D>) {}

  get documentRef(): DocumentReference<T> {
    return this.accessor.documentRef;
  }

  stream(): Observable<DocumentSnapshot<T>> {
    return this.accessor.stream();
  }

  create(data: WithFieldValue<T>): Promise<WriteResult | void> {
    return this.accessor.create(data);
  }

  get(): Promise<DocumentSnapshot<T>> {
    return this.accessor.get();
  }

  exists(): Promise<boolean> {
    return this.accessor.exists();
  }

  delete(params?: FirestoreDocumentDeleteParams): Promise<void | WriteResult> {
    return this.accessor.delete(params);
  }

  set(data: PartialWithFieldValue<T>, options: SetOptions): Promise<WriteResult | void>;
  set(data: WithFieldValue<T>): Promise<WriteResult | void>;
  set(data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions): Promise<void | WriteResult> {
    return this.accessor.set(data, options as SetOptions);
  }

  update(data: UpdateData<D>, params?: FirestoreDocumentUpdateParams): Promise<void | WriteResult> {
    return this.update(data, params);
  }
}

// MARK: Factory
export type WrapFirestoreDocumentDataAccessorFunction<T, D = DocumentData> = (input: FirestoreDocumentDataAccessor<T, D>) => FirestoreDocumentDataAccessor<T, D>;
export type InterceptAccessorFactoryFunction<T, D = DocumentData> = (input: FirestoreDocumentDataAccessorFactory<T, D>) => FirestoreDocumentDataAccessorFactory<T, D>;

export function interceptAccessorFactoryFunction<T, D = DocumentData>(wrap: WrapFirestoreDocumentDataAccessorFunction<T, D>): InterceptAccessorFactoryFunction<T, D> {
  return (input: FirestoreDocumentDataAccessorFactory<T, D>) => ({
    accessorFor: (ref) => wrap(input.accessorFor(ref))
  });
}
