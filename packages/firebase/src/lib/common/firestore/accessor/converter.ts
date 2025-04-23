import { type FactoryWithInput, type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type DocumentReference, type FirestoreDataConverter } from '../types';

/**
 * Factory that creates a FirestoreDataConverter for a specific document reference.
 *
 * This factory allows dynamic creation of data converters based on the specific document
 * reference being accessed. This enables different document references to have different
 * conversion logic even within the same collection.
 *
 * @template T - The document data type that the converter will transform to/from Firestore
 */
export type FirestoreDataConverterFactory<T> = FactoryWithInput<FirestoreDataConverter<T>, DocumentReference<T>>;

/**
 * Interface that provides access to a FirestoreDataConverterFactory.
 *
 * This interface is typically implemented by classes or objects that need to
 * reference a converter factory without directly containing the creation logic.
 * It enables separation between components that use converters and those that
 * define how conversion should happen.
 *
 * @template T - The document data type that the converter will transform to/from Firestore
 */
export interface FirestoreDataConverterFactoryRef<T> {
  /**
   * Factory function that creates a FirestoreDataConverter for a specific document reference.
   */
  readonly converterFactory: FirestoreDataConverterFactory<T>;
}

/**
 * Factory that optionally intercepts and provides a custom FirestoreDataConverter.
 *
 * Unlike FirestoreDataConverterFactory which always returns a converter, this factory
 * may return null/undefined to indicate that no custom converter should be used.
 * This allows for selective interception of converter creation based on specific criteria.
 *
 * This pattern is useful for middleware-like components that need to optionally modify
 * or replace converters without affecting the entire conversion pipeline.
 *
 * @template T - The document data type that the converter will transform to/from Firestore
 */
export type InterceptFirestoreDataConverterFactory<T> = FactoryWithRequiredInput<Maybe<FirestoreDataConverter<T>>, DocumentReference<T>>;
