import { type, type Type } from 'arktype';
import { type FirestoreModelKey, type FirestoreModelKeyRef } from '../../firestore/collection/collection';
import { firestoreModelIdType, firestoreModelKeyType } from './model.validator';

/**
 * API parameter type that targets a specific Firestore model by its full key path (e.g., `"collection/id"`).
 *
 * Used in `callModel` function parameter validation.
 */
export interface TargetModelParams extends FirestoreModelKeyRef {
  readonly key: FirestoreModelKey;
}

/**
 * ArkType validator for {@link TargetModelParams} — requires a valid full model key.
 */
export const targetModelParamsType = type({
  key: firestoreModelKeyType
}) as Type<TargetModelParams>;

/**
 * Variant of {@link TargetModelParams} where the key is optional, allowing the server to infer it from context.
 */
export interface InferredTargetModelParams extends Partial<FirestoreModelKeyRef> {
  readonly key?: FirestoreModelKey;
}

/**
 * ArkType validator for {@link InferredTargetModelParams}.
 */
export const inferredTargetModelParamsType = type({
  'key?': firestoreModelKeyType
}) as Type<InferredTargetModelParams>;

/**
 * API parameter type that targets a specific Firestore model by its document ID only (not the full path).
 *
 * Used when the collection is already known from the call context.
 */
export interface TargetModelIdParams extends FirestoreModelKeyRef {
  readonly key: FirestoreModelKey;
}

/**
 * ArkType validator for {@link TargetModelIdParams} — requires a valid document ID.
 */
export const targetModelIdParamsType = type({
  key: firestoreModelIdType
}) as Type<TargetModelIdParams>;

/**
 * Variant of {@link TargetModelIdParams} where the key is optional.
 */
export interface InferredTargetModelIdParams extends Partial<FirestoreModelKeyRef> {
  readonly key?: FirestoreModelKey;
}

/**
 * ArkType validator for {@link InferredTargetModelIdParams}.
 */
export const inferredTargetModelIdParamsType = type({
  'key?': firestoreModelIdType
}) as Type<InferredTargetModelIdParams>;
