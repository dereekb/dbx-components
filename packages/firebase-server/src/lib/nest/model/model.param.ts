import { FirestoreModelKey, FirestoreModelKeyRef } from '@dereekb/firebase';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Simple annotated params that implements FirestoreModelKeyRef.
 */
export class TargetModelParams implements FirestoreModelKeyRef {
  @Expose()
  @IsNotEmpty()
  @IsString()
  key!: FirestoreModelKey;
}
