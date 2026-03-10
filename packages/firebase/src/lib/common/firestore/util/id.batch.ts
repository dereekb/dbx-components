import { type ArrayOrValue, type FactoryWithRequiredInput, type IdBatchVerifier, type IdBatchVerifierFunction, type PrimativeKey, type ReadMultipleKeysFunction, unique } from '@dereekb/util';
import { type FirestoreCollectionLike } from '../collection';
import { type FirestoreQueryConstraint, FIRESTORE_MAX_WHERE_IN_FILTER_ARGS_COUNT, where, whereDocumentId } from '../query/constraint';
import { type DocumentSnapshot } from '../types';

// MARK: Verifier
/**
 * Base configuration for creating a Firestore-backed {@link IdBatchVerifier}.
 *
 * @template T - The Firestore document data type
 * @template I - The identifier/key type (must be a primitive key)
 */
export type FirestoreIdBatchVerifierFactoryBaseConfig<T, I extends PrimativeKey> = {
  /**
   * Extracts the identifier(s) from a queried document snapshot.
   * Used to determine which keys from a batch already exist in Firestore.
   */
  readKeys: ReadMultipleKeysFunction<DocumentSnapshot<T>, I>;
};

/**
 * Configuration that queries a specific document field for existence checks.
 * Use `'_id'` as the field value to query by document ID instead of a data field.
 *
 * @template T - The Firestore document data type
 * @template I - The identifier/key type
 */
export type FirestoreIdBatchVerifierFactoryFieldsQueryConfig<T, I extends PrimativeKey> = FirestoreIdBatchVerifierFactoryBaseConfig<T, I> & {
  /**
   * The document field to query with an `in` filter, or `'_id'` to query by document ID.
   */
  fieldToQuery: keyof T | '_id';
};

/**
 * Configuration that provides custom query constraints for existence checks.
 *
 * @template T - The Firestore document data type
 * @template I - The identifier/key type
 */
export type FirestoreIdBatchVerifierFactoryMakeQueryConfig<T, I extends PrimativeKey> = FirestoreIdBatchVerifierFactoryBaseConfig<T, I> & {
  /**
   * Creates query constraints to find documents matching the given keys.
   */
  makeQueryConstraints: FactoryWithRequiredInput<ArrayOrValue<FirestoreQueryConstraint>, I[]>;
};

/**
 * Union config type: either specify a field to query or provide custom query constraints.
 */
export type FirestoreIdBatchVerifierFactoryConfig<T, I extends PrimativeKey> = FirestoreIdBatchVerifierFactoryMakeQueryConfig<T, I> | FirestoreIdBatchVerifierFactoryFieldsQueryConfig<T, I>;

/**
 * Factory that creates an {@link IdBatchVerifier} bound to a specific Firestore collection.
 *
 * @template T - The Firestore document data type
 * @template I - The identifier/key type
 */
export type FirestoreIdBatchVerifierFactory<T, I extends PrimativeKey> = FactoryWithRequiredInput<IdBatchVerifier<I, I>, FirestoreCollectionLike<T>>;

/**
 * Creates a factory for Firestore-backed {@link IdBatchVerifier} instances.
 *
 * The verifier checks which keys from a batch do **not** already exist in a Firestore
 * collection, respecting Firestore's `where('in')` limit of {@link FIRESTORE_MAX_WHERE_IN_FILTER_ARGS_COUNT}
 * items per query. This is used for batch ID generation to ensure uniqueness.
 *
 * @template T - The Firestore document data type
 * @template I - The identifier/key type
 * @param config - Specifies how to query for existing keys (by field or custom constraints)
 * @returns A factory that produces verifiers bound to a specific collection
 *
 * @example
 * ```ts
 * const factory = firestoreIdBatchVerifierFactory<MyDoc, string>({
 *   fieldToQuery: '_id',
 *   readKeys: (snapshot) => [snapshot.id]
 * });
 *
 * const verifier = factory(myCollection);
 * // verifier can now check batches of IDs for uniqueness
 * ```
 */
export function firestoreIdBatchVerifierFactory<T, I extends PrimativeKey>(config: FirestoreIdBatchVerifierFactoryConfig<T, I>): FirestoreIdBatchVerifierFactory<T, I> {
  const { readKeys } = config;
  const fieldToQuery: keyof T | '_id' = (config as FirestoreIdBatchVerifierFactoryFieldsQueryConfig<T, I>).fieldToQuery;
  const makeQueryConstraints = (config as FirestoreIdBatchVerifierFactoryMakeQueryConfig<T, I>).makeQueryConstraints ? (config as FirestoreIdBatchVerifierFactoryMakeQueryConfig<T, I>).makeQueryConstraints : fieldToQuery === '_id' ? (ids: I[]) => whereDocumentId('in', ids) : (ids: I[]) => where(fieldToQuery as string, 'in', ids);

  return (collection: FirestoreCollectionLike<T>) => {
    const verify: IdBatchVerifierFunction<I> = async (keys: I[]) => {
      const constraints = makeQueryConstraints(keys);
      const results = await collection.query(constraints).getDocs();
      const keysInResults: I[] = results.docs.map((x) => readKeys(x)).flat();
      const unusedKeys = unique(keys, keysInResults);
      return unusedKeys;
    };

    const verifier: IdBatchVerifier<I, I> = {
      maxBatchSize: FIRESTORE_MAX_WHERE_IN_FILTER_ARGS_COUNT,
      filterUnique: unique,
      verify
    };

    return verifier;
  };
}
