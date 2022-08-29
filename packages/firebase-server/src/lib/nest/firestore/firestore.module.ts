import * as admin from 'firebase-admin';
import { InjectionToken, Module, ModuleMetadata, Provider } from '@nestjs/common';
import { FirestoreContext } from '@dereekb/firebase';
import { ClassLikeType } from '@dereekb/util';
import { googleCloudFirestoreContextFactory } from '../../firestore/firestore';
import { FIREBASE_APP_TOKEN } from '../firebase/firebase.module';

// MARK: Tokens
/**
 * Token to access the Firestore.
 */
export const FIREBASE_FIRESTORE_TOKEN: InjectionToken = 'FIREBASE_FIRESTORE_TOKEN';

/**
 * Token to access the root FirestoreContext for a server.
 */
export const FIREBASE_FIRESTORE_CONTEXT_TOKEN: InjectionToken = 'FIREBASE_FIRESTORE_CONTEXT_TOKEN';

/**
 * Nest provider module for Firebase that provides a firestore, etc. from the firestore token.
 */
@Module({
  providers: [
    {
      provide: FIREBASE_FIRESTORE_TOKEN,
      useFactory: (app: admin.app.App) => app.firestore(),
      inject: [FIREBASE_APP_TOKEN]
    }
  ],
  exports: [FIREBASE_FIRESTORE_TOKEN]
})
export class FirebaseServerFirestoreModule {}

/**
 * Nest provider module for firebase that includes the FirebaseServerFirestoreModule and provides a value for FIRESTORE_CONTEXT_TOKEN using the googleCloudFirestoreContextFactory.
 */
@Module({
  imports: [FirebaseServerFirestoreModule],
  providers: [
    {
      provide: FIREBASE_FIRESTORE_CONTEXT_TOKEN,
      useFactory: googleCloudFirestoreContextFactory,
      inject: [FIREBASE_FIRESTORE_TOKEN]
    }
  ],
  exports: [FirebaseServerFirestoreModule, FIREBASE_FIRESTORE_CONTEXT_TOKEN]
})
export class FirebaseServerFirestoreContextModule {}

// MARK: AppFirestoreCollections
export type ProvideAppFirestoreCollectionsFactory<T> = (context: FirestoreContext) => T;

export interface ProvideAppFirestoreCollectionsConfig<T> {
  provide: ClassLikeType<T>;
  useFactory: ProvideAppFirestoreCollectionsFactory<T>;
}

/**
 * Used to configure a Nestjs provider for a FirestoreCollections-type object that is initialized with a FirestoreContext.
 *
 * @param type
 * @param useFactory
 * @returns
 */
export function provideAppFirestoreCollections<T>({ provide, useFactory }: ProvideAppFirestoreCollectionsConfig<T>): [Provider<T>] {
  return [
    {
      provide,
      useFactory,
      inject: [FIREBASE_FIRESTORE_CONTEXT_TOKEN]
    }
  ];
}

// MARK: app firestore module
export interface ProvideAppFirestoreModuleMetadataConfig<T> extends ProvideAppFirestoreCollectionsConfig<T>, Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {}

/**
 * Convenience function used to generate ModuleMetadata for an app's Firestore related modules and an appFirestoreCollection
 *
 * @param provide
 * @param useFactory
 * @returns
 */
export function appFirestoreModuleMetadata<T>(config: ProvideAppFirestoreModuleMetadataConfig<T>): ModuleMetadata {
  return {
    imports: [FirebaseServerFirestoreContextModule, ...(config.imports ?? [])],
    exports: [FirebaseServerFirestoreContextModule, config.provide, ...(config.exports ?? [])],
    providers: [...provideAppFirestoreCollections(config), ...(config.providers ?? [])]
  };
}
