import * as admin from 'firebase-admin';
import { InjectionToken, Module, ModuleMetadata, Provider } from '@nestjs/common';
import { ClassLikeType } from '@dereekb/util';
import { FIREBASE_APP_TOKEN } from '../firebase/firebase.nest';
import { googleCloudFirebaseStorageContextFactory } from './storage';

// MARK: Tokens
/**
 * Token to access the Storage.
 */
export const FIREBASE_STORAGE_TOKEN: InjectionToken = 'FIREBASE_STORAGE_TOKEN';

/**
 * Token to access the root StorageContext for a server.
 */
export const FIREBASE_STORAGE_CONTEXT_TOKEN: InjectionToken = 'FIREBASE_STORAGE_CONTEXT_TOKEN';

/**
 * Nest provider module for Firebase that provides a firestore, etc. from the firestore token.
 */
@Module({
  providers: [
    {
      provide: FIREBASE_STORAGE_TOKEN,
      useFactory: (app: admin.app.App) => app.storage(),
      inject: [FIREBASE_APP_TOKEN]
    }
  ],
  exports: [FIREBASE_STORAGE_TOKEN]
})
export class FirebaseServerStorageModule {}

/**
 * Nest provider module for firebase that includes the FirebaseServerStorageModule and provides a value for STORAGE_CONTEXT_TOKEN using the googleCloudStorageContextFactory.
 */
@Module({
  imports: [FirebaseServerStorageModule],
  providers: [
    {
      provide: FIREBASE_STORAGE_CONTEXT_TOKEN,
      useFactory: googleCloudFirebaseStorageContextFactory,
      inject: [FIREBASE_STORAGE_TOKEN]
    }
  ],
  exports: [FirebaseServerStorageModule, FIREBASE_STORAGE_CONTEXT_TOKEN]
})
export class FirebaseServerStorageContextModule {}
