import { type FirebaseStorageAccessor, type FirebaseStorageAccessorFile, type FirebaseStorageAccessorFolder, type FirebaseStorageContext, type StoragePathInput } from '@dereekb/firebase';

// MARK: Service
/**
 * Reference to a FirebaseServerStorageService
 */
export interface FirebaseServerStorageServiceRef<S extends FirebaseServerStorageService = FirebaseServerStorageService> {
  readonly storageService: S;
}

/**
 * Basic service that implements FirebaseStorageAccessor and provides a FirebaseStorageContext.
 */
export class FirebaseServerStorageService implements FirebaseStorageAccessor {
  constructor(readonly storageContext: FirebaseStorageContext) {}

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
