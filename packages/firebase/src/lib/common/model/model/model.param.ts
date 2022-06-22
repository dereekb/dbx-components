import { Expose } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';
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
