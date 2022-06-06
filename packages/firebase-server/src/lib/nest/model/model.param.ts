import { FirestoreModelKey, FirestoreModelKeyRef } from '@dereekb/firebase';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

/**
 * Simple annotated params that
 */
export class TargetModelParams implements FirestoreModelKeyRef {
  @Expose()
  @IsString()
  key!: FirestoreModelKey;
}
