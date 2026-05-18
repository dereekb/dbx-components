import { type Observable } from 'rxjs';
import type { Maybe } from '@dereekb/util';
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
   * @param accessor - The accessor instance to wrap.
   */
  constructor(accessor: FirestoreDocumentDataAccessor<T, D>) {
    this._accessor = accessor;
  }

  /**
   * Gets the wrapped accessor instance.
   *
   * @returns The wrapped FirestoreDocumentDataAccessor instance.
   */
  get accessor(): FirestoreDocumentDataAccessor<T, D> {
    return this._accessor;
  }

  /**
   * Gets the document reference from the wrapped accessor.
   *
   * @returns The DocumentReference for the current document.
   */
  get documentRef(): DocumentReference<T> {
    return this.accessor.documentRef;
  }

  /**
   * Streams document snapshots from the wrapped accessor.
   *
   * @returns An Observable that emits DocumentSnapshots when the document changes.
   */
  stream(): Observable<DocumentSnapshot<T>> {
    return this.accessor.stream();
  }

  /**
   * Creates a new document with the provided data.
   *
   * @param data - Initial document contents.
   * @returns Resolves when the create operation completes.
   */
  create(data: WithFieldValue<T>): Promise<WriteResult | void> {
    return this.accessor.create(data);
  }

  /**
   * Gets the current document snapshot.
   *
   * @returns Resolves with the latest snapshot read for this document.
   */
  get(): Promise<DocumentSnapshot<T>> {
    return this.accessor.get();
  }

  /**
   * Gets the document snapshot with a specific data converter.
   *
   * @param converter - Converter applied to the raw snapshot, or null to skip conversion.
   * @returns Resolves with the converted snapshot.
   *
   * @template U - The converted data type
   */
  getWithConverter<U = DocumentData>(converter: Maybe<FirestoreDataConverter<U>>): Promise<DocumentSnapshot<U>> {
    return this.accessor.getWithConverter(converter);
  }

  /**
   * Checks if the document exists.
   *
   * @returns Resolves with true when the document is present, otherwise false.
   */
  exists(): Promise<boolean> {
    return this.accessor.exists();
  }

  /**
   * Deletes the document.
   *
   * @param params - Overrides applied to the delete operation, if any.
   * @returns Resolves when the delete operation completes.
   */
  delete(params?: FirestoreDocumentDeleteParams): Promise<void | WriteResult> {
    return this.accessor.delete(params);
  }

  /**
   * Sets document data with merge options.
   *
   * @param data - Partial fields written to the document.
   * @param options - Controls merge behavior (e.g., merge or mergeFields).
   * @returns Resolves when the set operation completes.
   */
  set(data: PartialWithFieldValue<T>, options: SetOptions): Promise<WriteResult | void>;
  /**
   * Sets document data, replacing any existing data.
   *
   * @param data - Full replacement contents for the document.
   * @returns Resolves when the set operation completes.
   */
  set(data: WithFieldValue<T>): Promise<WriteResult | void>;
  set(data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions): Promise<void | WriteResult> {
    return this.accessor.set(data, options as SetOptions);
  }

  /**
   * Updates specific fields of the document.
   *
   * @param data - Field paths mapped to their new values.
   * @param params - Overrides applied to the update operation, if any.
   * @returns Resolves when the update operation completes.
   */
  update(data: UpdateData<D>, params?: FirestoreDocumentUpdateParams): Promise<void | WriteResult> {
    return this.accessor.update(data, params);
  }

  /**
   * Increments numeric fields in the document.
   *
   * @param data - Field paths mapped to their increment amounts.
   * @param params - Overrides applied to the increment operation, if any.
   * @returns Resolves when the increment operation completes.
   */
  increment(data: FirestoreAccessorIncrementUpdate<T>, params?: FirestoreDocumentUpdateParams): Promise<WriteResult | void> {
    return this.accessor.increment(data, params);
  }

  /**
   * Updates array fields in the document.
   *
   * @param data - Array operations (union/remove) to apply per field.
   * @param params - Overrides applied to the update operation, if any.
   * @returns Resolves when the update operation completes.
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
 * @param wrap - Wraps each accessor produced by the original factory.
 * @returns Factory transformer that pipes accessors through the wrapper.
 *
 * @template T - The document data type
 * @template D - The raw document data type in Firestore
 *
 * @__NO_SIDE_EFFECTS__
 */
export function interceptAccessorFactoryFunction<T, D = DocumentData>(wrap: WrapFirestoreDocumentDataAccessorFunction<T, D>): InterceptAccessorFactoryFunction<T, D> {
  return (input: FirestoreDocumentDataAccessorFactory<T, D>) => ({
    accessorFor: (ref) => wrap(input.accessorFor(ref))
  });
}
