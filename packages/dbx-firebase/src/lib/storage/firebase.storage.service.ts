import { Service, inject } from '@angular/core';
import {
  type FirebaseStorageContext,
  type FirebaseStorageAccessor,
  type FirebaseStorageAccessorFile,
  type FirebaseStorageAccessorFolder,
  GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT,
  type StorageDownloadUrl,
  type StoragePath,
  type StoragePathInput,
  type StoragePublicUrlApiEndpoint,
  storagePublicDownloadUrl
} from '@dereekb/firebase';
import { DBX_FIREBASE_STORAGE_CONTEXT_TOKEN } from './firebase.storage';
import { DbxFirebaseEmulatorService } from '../firebase/firebase.emulator.service';

/**
 * Service that provides access to the app's FirebaseStorageContext.
 */
@Service()
export class DbxFirebaseStorageService implements FirebaseStorageAccessor {
  readonly storageContext = inject<FirebaseStorageContext>(DBX_FIREBASE_STORAGE_CONTEXT_TOKEN);
  readonly dbxFirebaseEmulatorService = inject(DbxFirebaseEmulatorService);

  defaultBucket() {
    return this.storageContext.defaultBucket();
  }

  file(path: StoragePathInput): FirebaseStorageAccessorFile {
    return this.storageContext.file(path);
  }

  folder(path: StoragePathInput): FirebaseStorageAccessorFolder {
    return this.storageContext.folder(path);
  }

  /**
   * The origin that serves this app's public storage objects.
   *
   * Resolves to the storage emulator's origin when the app is emulating, and the production Google Cloud
   * Storage origin otherwise. This mirrors what the client SDK itself does when it maps a Firebase Storage
   * host to its cloud-storage counterpart: an emulated host serves both channels, while the default
   * Firebase host pairs with `storage.googleapis.com`.
   *
   * @returns The origin that serves this app's public storage objects.
   */
  publicUrlApiEndpoint(): StoragePublicUrlApiEndpoint {
    return this.dbxFirebaseEmulatorService.storageEmulatorOrigin ?? GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT;
  }

  /**
   * Derives the permanent, anonymously-readable download url for the object at the input path.
   *
   * A pure client-side derivation: no request, no auth, and no expiration, so it can be resolved before
   * first render. The url only actually resolves for an object that exists AND is public — callers are
   * responsible for knowing that about the path they pass.
   *
   * @param path - Path of the object. A StorageFile document satisfies this, as it carries its own bucket
   * and path; a bare path string resolves against the context's default bucket.
   * @returns The object's public download url.
   */
  publicDownloadUrl(path: StoragePathInput): StorageDownloadUrl {
    const storagePath: StoragePath = this.storageContext.storagePath(path);
    return storagePublicDownloadUrl({ apiEndpoint: this.publicUrlApiEndpoint(), storagePath });
  }
}
