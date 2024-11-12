import { Inject, Injectable, inject } from '@angular/core';
import { FirebaseStorageContext, FirebaseStorageAccessor, FirebaseStorageAccessorFile, FirebaseStorageAccessorFolder, StoragePathInput } from '@dereekb/firebase';
import { DBX_FIREBASE_STORAGE_CONTEXT_TOKEN } from './firebase.storage';

/**
 * Service that provides access to the app's FirebaseStorageContext.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseStorageService implements FirebaseStorageAccessor {
  readonly storageContext = inject<FirebaseStorageContext>(DBX_FIREBASE_STORAGE_CONTEXT_TOKEN);

  defaultBucket() {
    return this.storageContext.defaultBucket();
  }

  file(path: StoragePathInput): FirebaseStorageAccessorFile {
    return this.storageContext.file(path);
  }

  folder(path: StoragePathInput): FirebaseStorageAccessorFolder {
    return this.storageContext.folder(path);
  }
}
