import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { SimpleStorageAccessorFactory, type StorageAccessor } from '@dereekb/dbx-core';
import { DBX_FIREBASE_STORAGEFILE_DOWNLOAD_STORAGE_ACCESSOR_TOKEN, DbxFirebaseStorageFileDownloadStorage, type DbxFirebaseStorageFileDownloadUserCache } from './service/storagefile.download.storage.service';
import { DbxFirebaseStorageFileDownloadService } from './service/storagefile.download.service';

/**
 * Factory function for creating a StorageAccessor for the model view tracker.
 */
export function defaultDbxFirebaseStorageFileDownloadStorageAccessorFactory(storageAccessorFactory: SimpleStorageAccessorFactory): StorageAccessor<DbxFirebaseStorageFileDownloadUserCache> {
  const accessor = storageAccessorFactory.createStorageAccessor<DbxFirebaseStorageFileDownloadUserCache>({
    prefix: 'sfds'
  });

  return accessor;
}

/**
 * Creates EnvironmentProviders for providing DbxModelTrackerService, DbxModelObjectStateService and sets up the NgRx store for DbxModelTrackerEffects.
 *
 * @returns EnvironmentProviders
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
