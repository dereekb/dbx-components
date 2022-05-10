import * as admin from 'firebase-admin';
import { FactoryProvider, InjectionToken, Module, ModuleMetadata, Provider } from "@nestjs/common";
import { FirestoreContext } from '@dereekb/firebase';
import { Firestore } from '@google-cloud/firestore';
import { googleCloudFirestoreContextFactory } from '../firestore/firestore';
import { ClassLikeType } from '@dereekb/util';

// MARK: Tokens
/**
 * Nest Injection Token to access the 
 */
export const FIREBASE_APP_TOKEN: InjectionToken = 'FIREBASE_APP_TOKEN';

/**
 * Token to access the Firestore.
 */
export const FIRESTORE_TOKEN: InjectionToken = 'FIRESTORE_TOKEN';

/**
 * Token to access the root FirestoreContext for a server.
 */
export const FIRESTORE_CONTEXT_TOKEN: InjectionToken = 'FIRESTORE_CONTEXT_TOKEN';

// MARK: Firebase Admin Provider
export function firebaseServerAppTokenProvider(useFactory: () => admin.app.App): FactoryProvider<any> {
  return {
    provide: FIREBASE_APP_TOKEN,
    useFactory
  };
}

/**
 * Nest provider module for Firebase that provides a firestore, etc. from the firestore token.
 */
@Module({
  providers: [{
    provide: FIRESTORE_TOKEN,
    useFactory: (app: admin.app.App) => app.firestore(),
    inject: [FIREBASE_APP_TOKEN]
  }],
  exports: [FIRESTORE_TOKEN]
})
export class FirebaseServerFirestoreModule { }

/**
 * Nest provider module for firebase that includes the FirebaseServerFirestoreModule and provides a value for FIRESTORE_CONTEXT_TOKEN using the googleCloudFirestoreContextFactory.
 */
@Module({
  imports: [FirebaseServerFirestoreModule],
  providers: [{
    provide: FIRESTORE_CONTEXT_TOKEN,
    useFactory: googleCloudFirestoreContextFactory,
    inject: [FIRESTORE_TOKEN]
  }],
  exports: [FirebaseServerFirestoreModule, FIRESTORE_CONTEXT_TOKEN]
})
export class FirebaseServerFirestoreContextModule { }

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
  return [{
    provide,
    useFactory,
    inject: [FIRESTORE_CONTEXT_TOKEN]
  }];
}

// MARK: app firestore module
export interface ProvideAppModuleMetadataConfig<T> extends ProvideAppFirestoreCollectionsConfig<T>, Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> { }

/**
 * Convenience function used to generate ModuleMetadata for an app's Firestore related modules and an appFirestoreCollection
 * 
 * @param provide 
 * @param useFactory 
 * @returns 
 */
export function appFirestoreModuleMetadata<T>(config: ProvideAppModuleMetadataConfig<T>): ModuleMetadata {
  return {
    imports: [FirebaseServerFirestoreContextModule, ...(config.imports ?? [])],
    exports: [FirebaseServerFirestoreContextModule, config.provide, ...(config.exports ?? [])],
    providers: [...provideAppFirestoreCollections(config), ...(config.providers ?? [])]
  };
}
