import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { clientFirebaseFirestoreContextFactory, type FirestoreContext, type FirestoreContextCacheFactory, NotificationFirestoreCollections, StorageFileFirestoreCollections, SystemStateFirestoreCollections } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { DBX_FIRESTORE_CONTEXT_TOKEN } from './firebase.firestore';
import { Firestore } from '@angular/fire/firestore';
import { type ClassLikeType } from '@dereekb/util';

/**
 * Provider factory for the SystemStateFirestoreCollections.
 *
 * @param appCollection The app collection class to use.
 * @returns Provider factory for the SystemStateFirestoreCollections.
 */
export function provideSystemStateFirestoreCollections(appCollection: SystemStateFirestoreCollections): SystemStateFirestoreCollections {
  if (!appCollection.systemStateCollection) {
    throw new Error(`SystemStateFirestoreCollections could not be provided using the app's app collection. Set provideSystemStateFirestoreCollections to false in DbxFirebaseFirestoreCollectionModuleConfig to prevent auto-initialization, or update your app's collection class to implement SystemStateFirestoreCollections.`);
  }

  return appCollection;
}

/**
 * Provider factory for the NotificationFirestoreCollections.
 *
 * @param appCollection The app collection class to use.
 * @returns Provider factory for the NotificationFirestoreCollections.
 */
export function provideNotificationFirestoreCollections(appCollection: NotificationFirestoreCollections): NotificationFirestoreCollections {
  if (!appCollection.notificationSummaryCollection) {
    throw new Error(`NotificationFirestoreCollections could not be provided using the app's app collection. Set provideNotificationFirestoreCollections to false in DbxFirebaseFirestoreCollectionModuleConfig to prevent auto-initialization, or update your app's collection class to implement NotificationFirestoreCollections.`);
  }

  return appCollection;
}

/**
 * Provider factory for the StorageFileFirestoreCollections.
 *
 * @param appCollection The app collection class to use.
 * @returns Provider factory for the StorageFileFirestoreCollections.
 */
export function provideStorageFileFirestoreCollections(appCollection: StorageFileFirestoreCollections): StorageFileFirestoreCollections {
  if (!appCollection.storageFileCollection) {
    throw new Error(`StorageFileFirestoreCollections could not be provided using the app's app collection. Set provideStorageFileFirestoreCollections to false in DbxFirebaseFirestoreCollectionModuleConfig to prevent auto-initialization, or update your app's collection class to implement StorageFileFirestoreCollections.`);
  }

  return appCollection;
}

/**
 * Configuration for provideDbxFirestoreCollection().
 */
export interface ProvideDbxFirebaseFirestoreCollectionConfig<T> {
  /**
   * The app collection class to use.
   */
  readonly appCollectionClass: ClassLikeType<T>;
  /**
   * The collection factory to use.
   */
  readonly collectionFactory: (context: FirestoreContext) => T;
  /**
   * Whether or not to provide the SystemStateFirestoreCollections.
   *
   * True by default.
   */
  readonly provideSystemStateFirestoreCollections?: boolean;
  /**
   * Whether or not to provide the NotificationFirestoreCollections.
   *
   * False by default.
   */
  readonly provideNotificationFirestoreCollections?: boolean;
  /**
   * Whether or not to provide the StorageFileFirestoreCollections.
   *
   * False by default.
   */
  readonly provideStorageFileFirestoreCollections?: boolean;
  /**
   * Optional cache factory to enable collection-level caching.
   *
   * When provided, the Firestore context will create a {@link FirestoreContextCache}
   * that provides TTL-based caching for document reads across all collections.
   *
   * @example
   * ```ts
   * import { inMemoryFirestoreContextCacheFactory } from '@dereekb/firebase';
   *
   * provideDbxFirestoreCollection({
   *   appCollectionClass: MyCollections,
   *   collectionFactory: (ctx) => new MyCollections(ctx),
   *   firestoreContextCacheFactory: inMemoryFirestoreContextCacheFactory()
   * });
   * ```
   */
  readonly firestoreContextCacheFactory?: Maybe<FirestoreContextCacheFactory>;
}

/**
 * Creates EnvironmentProviders for the DBX_FIRESTORE_CONTEXT_TOKEN, appCollectionClass, and optionally the SystemStateFirestoreCollections and NotificationFirestoreCollections.
 *
 * @param config Configuration for the providers.
 * @returns EnvironmentProviders
 */
export function provideDbxFirestoreCollection<T>(config: ProvideDbxFirebaseFirestoreCollectionConfig<T>): EnvironmentProviders {
  const params = config.firestoreContextCacheFactory ? { firestoreContextCacheFactory: config.firestoreContextCacheFactory } : undefined;

  const providers: Provider[] = [
    {
      provide: DBX_FIRESTORE_CONTEXT_TOKEN,
      useFactory: (firestore: InstanceType<typeof Firestore>) => clientFirebaseFirestoreContextFactory(firestore, params),
      deps: [Firestore]
    },
    {
      provide: config.appCollectionClass,
      useFactory: config.collectionFactory,
      deps: [DBX_FIRESTORE_CONTEXT_TOKEN]
    }
  ];

  if (config.provideSystemStateFirestoreCollections !== false) {
    providers.push({
      /**
       * Provide SystemStateFirestoreCollections via the app collections class and using SystemStateFirestoreCollections.
       */
      provide: SystemStateFirestoreCollections,
      useFactory: provideSystemStateFirestoreCollections,
      deps: [config.appCollectionClass]
    });
  }

  if (config.provideNotificationFirestoreCollections) {
    providers.push({
      provide: NotificationFirestoreCollections,
      useFactory: provideNotificationFirestoreCollections,
      deps: [config.appCollectionClass]
    });
  }

  if (config.provideStorageFileFirestoreCollections) {
    providers.push({
      provide: StorageFileFirestoreCollections,
      useFactory: provideStorageFileFirestoreCollections,
      deps: [config.appCollectionClass]
    });
  }

  return makeEnvironmentProviders(providers);
}
