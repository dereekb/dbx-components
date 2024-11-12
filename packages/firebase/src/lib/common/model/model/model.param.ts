import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { type FirestoreModelKey, type FirestoreModelKeyRef } from '../../firestore/collection/collection';
import { IsFirestoreModelId, IsFirestoreModelKey } from './model.validator';

/**
 * Simple annotated params that implements FirestoreModelKeyRef.
 */
export class TargetModelParams implements FirestoreModelKeyRef {
  @Expose()
  @IsNotEmpty()
  @IsFirestoreModelKey()
  key!: FirestoreModelKey;
}

export class InferredTargetModelParams implements Partial<FirestoreModelKeyRef> {
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsFirestoreModelKey()
  key?: FirestoreModelKey;
}

/**
 * Simple annotated params that implements FirestoreModelKeyRef but key is a FirestoreModelId.
 */
export class TargetModelIdParams implements FirestoreModelKeyRef {
  @Expose()
  @IsNotEmpty()
  @IsFirestoreModelId()
  key!: FirestoreModelKey;
}

export class InferredTargetModelIdParams implements Partial<FirestoreModelKeyRef> {
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsFirestoreModelId()
  key?: FirestoreModelKey;
}
