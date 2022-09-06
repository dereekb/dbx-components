import { ArrayOrValue, FactoryWithRequiredInput, IdBatchVerifier, IdBatchVerifierFunction, PrimativeKey, ReadMultipleKeysFunction, unique } from '@dereekb/util';
import { FirestoreCollectionLike } from '../collection';
import { FirestoreQueryConstraint, FIRESTORE_MAX_WHERE_IN_FILTER_ARGS_COUNT, where, whereDocumentId } from '../query/constraint';
import { DocumentSnapshot } from '../types';

// MARK: Verifier
export type FirestoreIdBatchVerifierFactoryBaseConfig<T, I extends PrimativeKey> = {
  /**
   * Reads the existing identifier(s) from the queried model.
   */
  readKeys: ReadMultipleKeysFunction<DocumentSnapshot<T>, I>;
};

export type FirestoreIdBatchVerifierFactoryFieldsQueryConfig<T, I extends PrimativeKey> = FirestoreIdBatchVerifierFactoryBaseConfig<T, I> & {
  /**
   * Uses the keys in a query that checks for existence in this field.
   */
  fieldToQuery: keyof T | '_id';
};

export type FirestoreIdBatchVerifierFactoryMakeQueryConfig<T, I extends PrimativeKey> = FirestoreIdBatchVerifierFactoryBaseConfig<T, I> & {
  /**
   * Used to create query constraints for looking for models with the key.
   */
  makeQueryConstraints: FactoryWithRequiredInput<ArrayOrValue<FirestoreQueryConstraint>, I[]>;
};

export type FirestoreIdBatchVerifierFactoryConfig<T, I extends PrimativeKey> = FirestoreIdBatchVerifierFactoryMakeQueryConfig<T, I> | FirestoreIdBatchVerifierFactoryFieldsQueryConfig<T, I>;

export type FirestoreIdBatchVerifierFactory<T, I extends PrimativeKey> = FactoryWithRequiredInput<IdBatchVerifier<I>, FirestoreCollectionLike<T>>;

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

    const verifier: IdBatchVerifier<I> = {
      maxBatchSize: FIRESTORE_MAX_WHERE_IN_FILTER_ARGS_COUNT,
      findUnique: unique,
      verify
    };

    return verifier;
  };
}
