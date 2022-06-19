import { CollectionReferenceRef, FirestoreContextReference, QueryLikeReferenceRef } from '../reference';
import {
  FirestoreDocument,
  FirestoreDocumentAccessorFactory,
  FirestoreDocumentAccessorFactoryFunction,
  FirestoreDocumentAccessorFactoryConfig,
  firestoreDocumentAccessorFactory,
  FirestoreDocumentAccessorForTransactionFactory,
  FirestoreDocumentAccessorForWriteBatchFactory,
  firestoreDocumentAccessorContextExtension,
  LimitedFirestoreDocumentAccessorFactory,
  LimitedFirestoreDocumentAccessorForTransactionFactory,
  LimitedFirestoreDocumentAccessorForWriteBatchFactory,
  LimitedFirestoreDocumentAccessor,
  FirestoreDocumentAccessor
} from '../accessor/document';
import { FirestoreItemPageIterationBaseConfig, FirestoreItemPageIterationFactory, firestoreItemPageIterationFactory, FirestoreItemPageIterationFactoryFunction } from '../query/iterator';
import { firestoreQueryFactory, FirestoreQueryFactory } from '../query/query';
import { FirestoreDrivers } from '../driver/driver';
import { FirestoreCollectionQueryFactory, firestoreCollectionQueryFactory } from './collection.query';
import { ArrayOrValue, Building, ModelKey, ModelTypeString } from '@dereekb/util';

/**
 * The camelCase model name/type.
 */
export type FirestoreModelType = ModelTypeString;

/**
 * An all lowercase name that references a collection. Is usually the lowercase version of the FirestoreModelType.
 *
 * This is the part of the path that says what the collection is.
 *
 * Each collection name in the app should be unique, as usage of CollectionGroups would cause collections with the same name to be returned.
 */
export type FirestoreCollectionName = string;

export type FirestoreModelIdentityType = 'root' | 'nested';

/**
 * A firestore model's identity
 */
export type FirestoreModelIdentity<M extends FirestoreModelType = FirestoreModelType, C extends FirestoreCollectionName = FirestoreCollectionName> = FirestoreModelTypeRef<M> &
  FirestoreCollectionNameRef<C> & {
    readonly type: FirestoreModelIdentityType;
    /**
     * @deprecated use collectionName instead.
     *
     * Will be removed in the future.
     */
    readonly collection: C;
    /**
     * @deprecated use modelType instead.
     *
     * Will be removed in the future.
     */
    readonly model: M; // NOTE: Remove later on.
  };

export type FirestoreModelIdentityModelType<I> = I extends FirestoreModelIdentity<infer M> ? M : never;
export type FirestoreModelIdentityCollectionName<I> = I extends FirestoreModelIdentity<infer M, infer C> ? C : never;

/**
 * A root-level FirestoreModelIdentity
 */
export type RootFirestoreModelIdentity<M extends FirestoreModelType = FirestoreModelType, C extends FirestoreCollectionName = FirestoreCollectionName> = FirestoreModelIdentity<M, C> & {
  readonly type: 'root';
};

/**
 * A nested FirestoreModelIdentity with a parent.
 */
export type FirestoreModelIdentityWithParent<P extends FirestoreModelIdentity<string, string>, M extends FirestoreModelType = FirestoreModelType, C extends FirestoreCollectionName = FirestoreCollectionName> = FirestoreModelIdentity<M, C> & {
  readonly type: 'nested';
  readonly parent: P;
};

/**
 * A default collection name derived from the model name.
 */
export type FirestoreModelDefaultCollectionName<M extends FirestoreModelType> = `${Lowercase<M>}`;

export type FirestoreModelTypes<I extends FirestoreModelIdentity> = I extends FirestoreModelIdentity<infer M> ? M : never;

/**
 * Creates a FirestoreModelIdentity value.
 *
 * @param modelName
 * @returns
 */
export function firestoreModelIdentity<M extends FirestoreModelType>(modelName: M): RootFirestoreModelIdentity<M, FirestoreModelDefaultCollectionName<M>>;
export function firestoreModelIdentity<P extends FirestoreModelIdentity<string, string>, M extends FirestoreModelType>(parent: P, modelName: M): FirestoreModelIdentityWithParent<P, M, FirestoreModelDefaultCollectionName<M>>;
export function firestoreModelIdentity<M extends FirestoreModelType, C extends FirestoreCollectionName = FirestoreCollectionName>(modelName: M, collectionName: C): RootFirestoreModelIdentity<M, C>;
export function firestoreModelIdentity<P extends FirestoreModelIdentity<string, string>, M extends FirestoreModelType, C extends FirestoreCollectionName = FirestoreCollectionName>(parent: P, modelName: M, collectionName: C): FirestoreModelIdentityWithParent<P, M, C>;
export function firestoreModelIdentity<P extends FirestoreModelIdentity<string, string>, M extends FirestoreModelType, C extends FirestoreCollectionName = FirestoreCollectionName>(parentOrModelName: P | M, collectionNameOrModelName?: M | C, inputCollectionName?: C): FirestoreModelIdentityWithParent<P, M, C> | RootFirestoreModelIdentity<M, C> {
  if (typeof parentOrModelName === 'object') {
    const collectionName = (inputCollectionName as C) ?? ((collectionNameOrModelName as M).toLowerCase() as C);
    return {
      type: 'nested',
      parent: parentOrModelName as P,
      collectionName,
      collection: collectionName,
      model: collectionNameOrModelName as M,
      modelType: collectionNameOrModelName as M
    };
  } else {
    const collectionName = (collectionNameOrModelName as C) ?? (parentOrModelName.toLowerCase() as C);
    return {
      type: 'root',
      collectionName,
      collection: collectionName,
      model: parentOrModelName,
      modelType: parentOrModelName
    };
  }
}

/**
 * Reference to a FirestoreModelType
 */
export interface FirestoreModelTypeRef<M extends FirestoreModelType = FirestoreModelType> {
  /**
   * Returns the FirestoreModelType for this context.
   */
  readonly modelType: M;
}

/**
 * Reads the FirestoreModelType from a FirestoreModelType or FirestoreModelTypeRef.
 *
 * @param modelTypeInput
 * @returns
 */
export function firestoreModelType(modelTypeInput: FirestoreModelType | FirestoreModelTypeRef): FirestoreModelType {
  const modelType = typeof modelTypeInput === 'string' ? modelTypeInput : modelTypeInput.modelType;

  if (!modelType) {
    throw new Error('modelType is required.');
  }

  return modelType;
}

/**
 * Reference to a FirestoreCollectionName
 */
export interface FirestoreCollectionNameRef<C extends FirestoreCollectionName = FirestoreCollectionName> {
  /**
   * Returns the FirestoreCollectionName for this context.
   */
  readonly collectionName: C;
}

/**
 * Reference to a FirestoreModelIdentity via the FirestoreModelType and FirestoreCollectionName
 */
export interface FirestoreModelTypeModelIdentityRef<M extends FirestoreModelType = FirestoreModelType, C extends FirestoreCollectionName = FirestoreCollectionName> {
  /**
   * Returns the FirestoreModelIdentity for this context.
   */
  readonly modelIdentity: FirestoreModelIdentity<M, C>;
}

/**
 * Reference to a FirestoreModelIdentity
 */
export interface FirestoreModelIdentityRef<I extends FirestoreModelIdentity> {
  /**
   * Returns the FirestoreModelIdentity for this context.
   */
  readonly modelIdentity: I;
}

// MARK: Path
/**
 * The model's id within a collection.
 *
 * Different from the FirestoreModelKey, which is the full path in the databse.
 *
 * Example:
 *
 * 12345
 */
export type FirestoreModelId = string;

/**
 * Reference to a FirestoreModelId
 */
export interface FirestoreModelIdRef {
  /**
   * Returns the FirestoreModelId for this context.
   */
  readonly id: FirestoreModelId;
}

/**
 * The full path for a model in the Firestore database.
 *
 * Example:
 *
 * collection/12345/subcollection/67890
 */
export type FirestoreModelKey = ModelKey;

/**
 * A part of a FirestoreModelKey.
 */
export type FirestoreModelKeyPart<C extends FirestoreCollectionName = FirestoreCollectionName, K extends FirestoreModelId = FirestoreModelId> = `${C}/${K}`;

/**
 * One part of a FirestoreModelKe
 */
export type FirestoreCollectionModelKeyPart<N extends FirestoreCollectionNameRef = FirestoreCollectionNameRef, K extends FirestoreModelId = FirestoreModelId> = N extends FirestoreCollectionNameRef<infer C> ? FirestoreModelKeyPart<C, K> : never;
export type FirestoreCollectionModelKey<N extends FirestoreCollectionNameRef = FirestoreCollectionNameRef, K extends FirestoreModelId = FirestoreModelId> = FirestoreCollectionModelKeyPart<N, K>;

/**
 * Creates a firestoreModelKeyPart
 *
 * @param identity
 * @param id
 * @returns
 */
export function firestoreModelKeyPart<N extends FirestoreCollectionNameRef, K extends FirestoreModelId = FirestoreModelId>(identity: N, id: K): FirestoreCollectionModelKeyPart<N, K> {
  return `${identity.collectionName}/${id}` as FirestoreCollectionModelKeyPart<N, K>;
}

/**
 * Creates a firestoreModelKey for RootFirestoreModelIdentity values.
 *
 * @param identity
 * @param id
 * @returns
 */
export const firestoreModelKey = firestoreModelKeyPart as <I extends RootFirestoreModelIdentity, K extends FirestoreModelId = FirestoreModelId>(identity: I, id: K) => FirestoreCollectionModelKey<I, K>;

/**
 * Creates an array of FirestoreCollectionModelKey values from the input ids.
 *
 * @param identity
 * @param ids
 * @returns
 */
export function firestoreModelKeys<I extends RootFirestoreModelIdentity, K extends FirestoreModelId = FirestoreModelId>(identity: I, ids: K[]): FirestoreCollectionModelKey<I, K>[] {
  return ids.map((x) => firestoreModelKey(identity, x));
}

/**
 * Joins together a number of FirestoreModelKeyPart values.
 *
 * @param parts
 * @returns
 */
export function firestoreModelKeyPath(...parts: FirestoreModelKeyPart[]): FirestoreModelKey {
  return parts.join('/');
}

/**
 * Creates a number of child paths from the parent path.
 *
 * @param parent
 * @param children
 * @returns
 */
export function childFirestoreModelKeyPath(parent: FirestoreModelKeyPart, children: ArrayOrValue<FirestoreModelKeyPart>): FirestoreModelKey[] {
  if (Array.isArray(children)) {
    return children.map((childPath) => `${parent}/${childPath}`);
  } else {
    return [`${parent}/${children}`];
  }
}

/**
 * Reference to a FirestoreModelKey
 */
export interface FirestoreModelKeyRef {
  /**
   * Returns the FirestoreModelKey for this context.
   */
  readonly key: FirestoreModelKey;
}

// MARK: FirestoreCollectionLike
/**
 * Instance that provides several accessors for accessing documents of a collection.
 */
export interface FirestoreCollectionLike<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>>
  extends FirestoreContextReference,
    QueryLikeReferenceRef<T>,
    FirestoreItemPageIterationFactory<T>,
    FirestoreQueryFactory<T>,
    LimitedFirestoreDocumentAccessorFactory<T, D, A>,
    LimitedFirestoreDocumentAccessorForTransactionFactory<T, D, A>,
    LimitedFirestoreDocumentAccessorForWriteBatchFactory<T, D, A>,
    FirestoreCollectionQueryFactory<T, D> {}

// MARK: FirestoreCollection
/**
 * FirestoreCollection configuration
 */
export interface FirestoreCollectionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreContextReference, FirestoreDrivers, Omit<FirestoreItemPageIterationBaseConfig<T>, 'queryLike'>, Partial<QueryLikeReferenceRef<T>>, FirestoreDocumentAccessorFactoryConfig<T, D> {}

/**
 * Instance that provides several accessors for accessing documents of a collection.
 *
 * Provides a full FirestoreDocumentAccessor instead of limited accessors.
 */
export interface FirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreCollectionLike<T, D, FirestoreDocumentAccessor<T, D>>, CollectionReferenceRef<T>, FirestoreDocumentAccessorFactory<T, D>, FirestoreDocumentAccessorForTransactionFactory<T, D>, FirestoreDocumentAccessorForWriteBatchFactory<T, D> {
  readonly config: FirestoreCollectionConfig<T, D>;
}

/**
 * Ref to a FirestoreCollection
 */
export interface FirestoreCollectionRef<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly firestoreCollection: FirestoreCollection<T, D>;
}

/**
 * Creates a new FirestoreCollection from the input config.
 */
export function makeFirestoreCollection<T, D extends FirestoreDocument<T>>(inputConfig: FirestoreCollectionConfig<T, D>): FirestoreCollection<T, D> {
  const config = inputConfig as FirestoreCollectionConfig<T, D> & QueryLikeReferenceRef<T>;

  const { collection, firestoreContext, firestoreAccessorDriver } = config;
  (config as unknown as Building<QueryLikeReferenceRef<T>>).queryLike = collection;

  const firestoreIteration: FirestoreItemPageIterationFactoryFunction<T> = firestoreItemPageIterationFactory(config);
  const documentAccessor: FirestoreDocumentAccessorFactoryFunction<T, D> = firestoreDocumentAccessorFactory(config);
  const queryFactory: FirestoreQueryFactory<T> = firestoreQueryFactory(config);

  const documentAccessorExtension = firestoreDocumentAccessorContextExtension({ documentAccessor, firestoreAccessorDriver });
  const { queryDocument } = firestoreCollectionQueryFactory(queryFactory, documentAccessorExtension);
  const { query } = queryFactory;

  return {
    config,
    collection,
    queryLike: collection,
    firestoreContext,
    ...documentAccessorExtension,
    firestoreIteration,
    query,
    queryDocument
  };
}

// MARK: Compat
/**
 * Alternative name for FirestoreModelType.
 *
 * @deprecated replaced by FirestoreModelType
 */
export type FirestoreModelName = FirestoreModelType;

/**
 * @deprecated replaced by FirestoreModelTypeRef
 */
export type FirestoreModelNameRef<M extends FirestoreModelType = FirestoreModelType> = FirestoreModelTypeRef<M>;

/**
 * @deprecated replaced by FirestoreModelTypes
 */
export type FirestoreModelNames<I extends FirestoreModelIdentity> = FirestoreModelTypes<I>;
