import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { FirestoreModelKey, FirestoreModelKeyRef } from '../../firestore/collection/collection';

/**
 * Simple annotated params that implements FirestoreModelKeyRef.
 */
export class TargetModelParams implements FirestoreModelKeyRef {
  @Expose()
  @IsNotEmpty()
  @IsString()
  key!: FirestoreModelKey;
}
