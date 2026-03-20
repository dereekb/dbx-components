import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { SimpleStorageAccessorFactory, type StorageAccessor } from '@dereekb/dbx-core';
import { DBX_FIREBASE_STORAGEFILE_DOWNLOAD_STORAGE_ACCESSOR_TOKEN, DbxFirebaseStorageFileDownloadStorage, type DbxFirebaseStorageFileDownloadUserCache } from './service/storagefile.download.storage.service';
import { DbxFirebaseStorageFileDownloadService } from './service/storagefile.download.service';

/**
 * Factory function for creating a StorageAccessor for the storage file download cache.
 *
 * @param storageAccessorFactory - The factory used to create prefixed storage accessors.
 * @returns A StorageAccessor scoped to the storage file download cache.
 */
export function defaultDbxFirebaseStorageFileDownloadStorageAccessorFactory(storageAccessorFactory: SimpleStorageAccessorFactory): StorageAccessor<DbxFirebaseStorageFileDownloadUserCache> {
  return storageAccessorFactory.createStorageAccessor<DbxFirebaseStorageFileDownloadUserCache>({
    prefix: 'sfds'
  });
}

/**
 * Creates EnvironmentProviders for the storage file download service and its dependencies.
 *
 * @returns EnvironmentProviders that register the storage file download storage accessor, storage, and service.
 */
export function provideDbxFirebaseStorageFileService(): EnvironmentProviders {
  const providers: (Provider | EnvironmentProviders)[] = [
    // Storage accessor
    {
      provide: DBX_FIREBASE_STORAGEFILE_DOWNLOAD_STORAGE_ACCESSOR_TOKEN,
      useFactory: defaultDbxFirebaseStorageFileDownloadStorageAccessorFactory,
      deps: [SimpleStorageAccessorFactory]
    },
    // Service
    DbxFirebaseStorageFileDownloadStorage,
    DbxFirebaseStorageFileDownloadService
  ];

  return makeEnvironmentProviders(providers);
}
