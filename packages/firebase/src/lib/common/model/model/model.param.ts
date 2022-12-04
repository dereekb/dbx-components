import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { FirestoreModelId, FirestoreModelKey, FirestoreModelKeyRef } from '../../firestore/collection/collection';
import { IsFirestoreModelId, IsFirestoreModelKey } from './model.validator';

/**
 * Simple annotated params that implements FirestoreModelKeyRef.
 */
export class TargetModelParams implements FirestoreModelKeyRef {
  @Expose()
  @IsNotEmpty()
  @IsFirestoreModelKey()
  key!: string; // FirestoreModelKey // TODO: Replace once Jest importing issue is fixed. https://github.com/nrwl/nx/issues/13615
}

export class InferredTargetModelParams implements Partial<FirestoreModelKeyRef> {
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsFirestoreModelKey()
  key?: string; // FirestoreModelKey
}

/**
 * Simple annotated params that implements FirestoreModelKeyRef but key is a FirestoreModelId.
 */
export class TargetModelIdParams implements FirestoreModelKeyRef {
  @Expose()
  @IsNotEmpty()
  @IsFirestoreModelId()
  key!: string; // FirestoreModelId;
}

export class InferredTargetModelIdParams implements Partial<FirestoreModelKeyRef> {
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsFirestoreModelId()
  key?: string; // FirestoreModelId;
}
