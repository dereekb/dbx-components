import { FactoryWithInput, FactoryWithRequiredInput, Maybe } from '@dereekb/util';
import { DocumentReference, FirestoreDataConverter } from '../types';

/**
 * Factory used to provide an FirestoreDataConverter based on the input reference.
 */
export type FirestoreDataConverterFactory<T> = FactoryWithInput<FirestoreDataConverter<T>, DocumentReference<T>>;

/**
 * Ref to a FirestoreDataConverterFactory.
 */
export interface FirestoreDataConverterFactoryRef<T> {
  converterFactory: FirestoreDataConverterFactory<T>;
}

/**
 * Factory used to provide an optional custom FirestoreDataConverter based on the input reference.
 */
export type InterceptFirestoreDataConverterFactory<T> = FactoryWithRequiredInput<Maybe<FirestoreDataConverter<T>>, DocumentReference<T>>;
