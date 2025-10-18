import { type Observable } from 'rxjs';
import { type DocumentData, type DocumentReference, type DocumentSnapshot, type FirestoreDataConverter, type PartialWithFieldValue, type SetOptions, type UpdateData, type WithFieldValue, type WriteResult } from '../types';
import { type FirestoreAccessorArrayUpdate, type FirestoreAccessorIncrementUpdate, type FirestoreDocumentDataAccessor, type FirestoreDocumentDataAccessorFactory, type FirestoreDocumentDeleteParams, type FirestoreDocumentUpdateParams } from './accessor';

// MARK: Abstract Wrapper
/**
 * Abstract wrapper for a FirestoreDocumentDataAccessor that delegates operations.
 *
 * Provides a base implementation that forwards all accessor operations to the wrapped
 * accessor instance. Subclasses can override specific methods to modify or intercept
 * the behavior while inheriting the rest of the implementation.
 *
 * @template T - The document data type
 * @template D - The raw document data type in Firestore (defaults to DocumentData)
 */
export abstract class AbstractFirestoreDocumentDataAccessorWrapper<T, D = DocumentData> implements FirestoreDocumentDataAccessor<T, D> {
  private readonly _accessor: FirestoreDocumentDataAccessor<T, D>;

  /**
   * Creates a new accessor wrapper.
   *
   * @param accessor - The accessor instance to wrap
   */
  constructor(accessor: FirestoreDocumentDataAccessor<T, D>) {
    this._accessor = accessor;
  }

  /**
   * Gets the wrapped accessor instance.
   *
   * @returns The wrapped FirestoreDocumentDataAccessor instance
   */
  get accessor(): FirestoreDocumentDataAccessor<T, D> {
    return this._accessor;
  }

  /**
   * Gets the document reference from the wrapped accessor.
   *
   * @returns The DocumentReference for the current document
   */
  get documentRef(): DocumentReference<T> {
    return this.accessor.documentRef;
  }

  /**
   * Streams document snapshots from the wrapped accessor.
   *
   * @returns An Observable that emits DocumentSnapshots when the document changes
   */
  stream(): Observable<DocumentSnapshot<T>> {
    return this.accessor.stream();
  }

  /**
   * Creates a new document with the provided data.
   *
   * @param data - The data to create the document with
   * @returns A Promise that resolves when the create operation completes
   */
  create(data: WithFieldValue<T>): Promise<WriteResult | void> {
    return this.accessor.create(data);
  }

  /**
   * Gets the current document snapshot.
   *
   * @returns A Promise that resolves with the current DocumentSnapshot
   */
  get(): Promise<DocumentSnapshot<T>> {
    return this.accessor.get();
  }

  /**
   * Gets the document snapshot with a specific data converter.
   *
   * @template U - The converted data type
   * @param converter - The data converter to use, or null for raw data
   * @returns A Promise that resolves with the DocumentSnapshot with converted data
   */
  getWithConverter<U = DocumentData>(converter: null | FirestoreDataConverter<U>): Promise<DocumentSnapshot<U>> {
    return this.accessor.getWithConverter(converter);
  }

  /**
   * Checks if the document exists.
   *
   * @returns A Promise that resolves with true if the document exists, false otherwise
   */
  exists(): Promise<boolean> {
    return this.accessor.exists();
  }

  /**
   * Deletes the document.
   *
   * @param params - Optional parameters for the delete operation
   * @returns A Promise that resolves when the delete operation completes
   */
  delete(params?: FirestoreDocumentDeleteParams): Promise<void | WriteResult> {
    return this.accessor.delete(params);
  }

  /**
   * Sets document data with merge options.
   *
   * @param data - The partial data to set with merge
   * @param options - The set options (e.g., merge settings)
   * @returns A Promise that resolves when the set operation completes
   */
  set(data: PartialWithFieldValue<T>, options: SetOptions): Promise<WriteResult | void>;
  /**
   * Sets document data, replacing any existing data.
   *
   * @param data - The complete data to set
   * @returns A Promise that resolves when the set operation completes
   */
  set(data: WithFieldValue<T>): Promise<WriteResult | void>;
  set(data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions): Promise<void | WriteResult> {
    return this.accessor.set(data, options as SetOptions);
  }

  /**
   * Updates specific fields of the document.
   *
   * @param data - The fields to update and their new values
   * @param params - Optional parameters for the update operation
   * @returns A Promise that resolves when the update operation completes
   */
  update(data: UpdateData<D>, params?: FirestoreDocumentUpdateParams): Promise<void | WriteResult> {
    return this.accessor.update(data, params);
  }

  /**
   * Increments numeric fields in the document.
   *
   * @param data - Mapping of fields to increment and the amount to increment by
   * @param params - Optional parameters for the increment operation
   * @returns A Promise that resolves when the increment operation completes
   */
  increment(data: FirestoreAccessorIncrementUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult | void> {
    return this.accessor.increment(data, params);
  }

  /**
   * Updates array fields in the document.
   *
   * @param data - The array update to apply
   * @param params - Optional parameters for the update operation
   * @returns A Promise that resolves when the update operation completes
   */
  arrayUpdate(data: FirestoreAccessorArrayUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult | void> {
    return this.accessor.arrayUpdate(data, params);
  }
}

// MARK: Factory
/**
 * Function type for wrapping a document accessor with additional functionality.
 *
 * @template T - The document data type
 * @template D - The raw document data type in Firestore
 */
export type WrapFirestoreDocumentDataAccessorFunction<T, D = DocumentData> = (input: FirestoreDocumentDataAccessor<T, D>) => FirestoreDocumentDataAccessor<T, D>;

/**
 * Function type for intercepting an accessor factory to modify all created accessors.
 *
 * @template T - The document data type
 * @template D - The raw document data type in Firestore
 */
export type InterceptAccessorFactoryFunction<T, D = DocumentData> = (input: FirestoreDocumentDataAccessorFactory<T, D>) => FirestoreDocumentDataAccessorFactory<T, D>;

/**
 * Creates a function that intercepts an accessor factory to wrap all created accessors.
 *
 * This function creates a higher-order factory that wraps each accessor created by the
 * original factory with the provided wrapper function, allowing for consistent modification
 * of all accessors created through the factory.
 *
 * @template T - The document data type
 * @template D - The raw document data type in Firestore
 * @param wrap - Function to wrap each created accessor
 * @returns A function that transforms accessor factories to use the wrapper
 */
export function interceptAccessorFactoryFunction<T, D = DocumentData>(wrap: WrapFirestoreDocumentDataAccessorFunction<T, D>): InterceptAccessorFactoryFunction<T, D> {
  return (input: FirestoreDocumentDataAccessorFactory<T, D>) => ({
    accessorFor: (ref) => wrap(input.accessorFor(ref))
  });
}
