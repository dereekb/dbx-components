import { type FirebaseStorageAccessor, type FirebaseStorageAccessorFile, type FirebaseStorageAccessorFolder, type FirebaseStorageContext, type StoragePathInput } from '@dereekb/firebase';

// MARK: Service
/**
 * Reference to a FirebaseServerStorageService
 */
export interface FirebaseServerStorageServiceRef<S extends FirebaseServerStorageService = FirebaseServerStorageService> {
  readonly storageService: S;
}

/**
 * Server-side storage service that wraps a {@link FirebaseStorageContext} and implements
 * the {@link FirebaseStorageAccessor} interface for file and folder operations.
 *
 * Typically injected via NestJS and backed by the Google Cloud Storage driver.
 *
 * @example
 * ```typescript
 * const storageService = new FirebaseServerStorageService(storageContext);
 * const file = storageService.file({ bucketId: 'my-bucket', pathString: 'path/to/file.txt' });
 * ```
 */
export class FirebaseServerStorageService implements FirebaseStorageAccessor {
  private readonly _storageContext: FirebaseStorageContext;

  constructor(storageContext: FirebaseStorageContext) {
    this._storageContext = storageContext;
  }

  get storageContext(): FirebaseStorageContext {
    return this._storageContext;
  }

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
