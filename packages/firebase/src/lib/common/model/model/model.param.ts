import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { FirestoreModelKey, FirestoreModelKeyRef } from '../../firestore/collection/collection';
import { IsFirestoreModelKey } from './model.validator';

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
