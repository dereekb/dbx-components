import { type, type Type } from 'arktype';
import { type FirestoreModelKey, type FirestoreModelKeyRef } from '../../firestore/collection/collection';
import { firestoreModelIdType, firestoreModelKeyType } from './model.validator';

/**
 * Simple params that implements FirestoreModelKeyRef.
 */
export interface TargetModelParams extends FirestoreModelKeyRef {
  readonly key: FirestoreModelKey;
}

export const targetModelParamsType = type({
  key: firestoreModelKeyType
}) as Type<TargetModelParams>;

export interface InferredTargetModelParams extends Partial<FirestoreModelKeyRef> {
  readonly key?: FirestoreModelKey;
}

export const inferredTargetModelParamsType = type({
  'key?': firestoreModelKeyType
}) as Type<InferredTargetModelParams>;

/**
 * Simple params that implements FirestoreModelKeyRef but key is a FirestoreModelId.
 */
export interface TargetModelIdParams extends FirestoreModelKeyRef {
  readonly key: FirestoreModelKey;
}

export const targetModelIdParamsType = type({
  key: firestoreModelIdType
}) as Type<TargetModelIdParams>;

export interface InferredTargetModelIdParams extends Partial<FirestoreModelKeyRef> {
  readonly key?: FirestoreModelKey;
}

export const inferredTargetModelIdParamsType = type({
  'key?': firestoreModelIdType
}) as Type<InferredTargetModelIdParams>;
