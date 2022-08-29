import * as admin from 'firebase-admin';
import { FactoryProvider, InjectionToken, Module, ModuleMetadata, Provider } from '@nestjs/common';
import { FIREBASE_APP_TOKEN } from '../firebase/firebase.module';
import { googleCloudFirebaseStorageContextFactory, googleCloudStorageFromFirebaseAdminStorage, FirebaseServerStorageService } from '../../storage';
import { AdditionalModuleMetadata, injectionTokensFromProviders, mergeModuleMetadata } from '@dereekb/nestjs';
import { FirebaseStorageContext, FirebaseStorageContextFactoryConfig, StorageBucketId } from '@dereekb/firebase';

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
 * Token to the default bucket id string
 */
export const FIREBASE_STORAGE_CONTEXT_FACTORY_CONFIG_TOKEN: InjectionToken = 'FIREBASE_STORAGE_CONTEXT_FACTORY_CONFIG_TOKEN';

/**
 * Nest provider module for Firebase that provides a firestore, etc. from the firestore token.
 */
@Module({
  providers: [
    {
      provide: FIREBASE_STORAGE_TOKEN,
      useFactory: (app: admin.app.App) => googleCloudStorageFromFirebaseAdminStorage(app.storage()),
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
      inject: [FIREBASE_STORAGE_TOKEN, FIREBASE_STORAGE_CONTEXT_FACTORY_CONFIG_TOKEN]
    }
  ],
  exports: [FirebaseServerStorageModule, FIREBASE_STORAGE_CONTEXT_TOKEN]
})
export class FirebaseServerStorageContextModule {}

// MARK: Token Configuration
export function firebaseServerStorageDefaultBucketIdTokenProvider(input: StorageBucketId | FirebaseStorageContextFactoryConfig): Provider {
  const config = typeof input === 'string' ? { defaultBucketId: input } : input;

  if (!config.defaultBucketId) {
    throw new Error('Non-empty defaultBucketId is required.');
  }

  return {
    provide: FIREBASE_STORAGE_CONTEXT_FACTORY_CONFIG_TOKEN,
    useValue: config
  };
}

// MARK: AppAuth
export type ProvideFirebaseServerStorageServiceSimple<T extends FirebaseServerStorageService> = Pick<FactoryProvider<T>, 'provide'> & {
  useFactory: (context: FirebaseStorageContext) => T;
};

export function defaultProvideFirebaseServerStorageServiceSimple(): ProvideFirebaseServerStorageServiceSimple<FirebaseServerStorageService> {
  return {
    provide: FirebaseServerStorageService,
    useFactory: (context: FirebaseStorageContext) => new FirebaseServerStorageService(context)
  } as ProvideFirebaseServerStorageServiceSimple<FirebaseServerStorageService>;
}

export type ProvideFirebaseServerStorageService<T extends FirebaseServerStorageService> = FactoryProvider<T> | ProvideFirebaseServerStorageServiceSimple<T>;

export function provideFirebaseServerStorageService<T extends FirebaseServerStorageService = FirebaseServerStorageService>(provider: ProvideFirebaseServerStorageService<T>): Provider<T>[] {
  const providers: Provider<T>[] = [
    {
      ...provider,
      inject: (provider as FactoryProvider<T>).inject ?? [FIREBASE_STORAGE_CONTEXT_TOKEN]
    }
  ];

  if (provider.provide !== FirebaseServerStorageService) {
    providers.push({
      provide: FirebaseServerStorageService,
      useExisting: provider.provide
    });
  }

  return providers;
}

// MARK: app firebase auth module
export interface FirebaseServerStorageModuleMetadataConfig<T extends FirebaseServerStorageService = FirebaseServerStorageService> extends AdditionalModuleMetadata {
  readonly serviceProvider?: ProvideFirebaseServerStorageService<T>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Auth related modules and FirebaseServerStorageService provider.
 *
 * @param provide
 * @param useFactory
 * @returns
 */
export function firebaseServerStorageModuleMetadata<T extends FirebaseServerStorageService = FirebaseServerStorageService>(config?: FirebaseServerStorageModuleMetadataConfig<T>): ModuleMetadata {
  const serviceProvider = config && config.serviceProvider ? config.serviceProvider : defaultProvideFirebaseServerStorageServiceSimple();
  const providers = provideFirebaseServerStorageService(serviceProvider);
  const tokensToExport = injectionTokensFromProviders(providers);

  return mergeModuleMetadata(
    {
      imports: [FirebaseServerStorageContextModule],
      exports: [FirebaseServerStorageContextModule, ...tokensToExport],
      providers
    },
    config
  );
}
