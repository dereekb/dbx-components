import { Injectable, InjectionToken, inject } from '@angular/core';
import { StorageAccessor } from '@dereekb/dbx-core';
import { map, mergeMap, catchError, Observable, of, switchMap, first } from 'rxjs';
import { FirebaseAuthUserId, firestoreModelId, FirestoreModelIdInput, StorageFileId, StorageFileSignedDownloadUrl } from '@dereekb/firebase';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { UnixTimeNumber } from '@dereekb/util';

export interface DbxFirebaseStorageFileDownloadUrlPair {
  readonly id: StorageFileId;
  readonly downloadUrl: StorageFileSignedDownloadUrl;
  /**
   * Expiration in seconds since epoch.
   */
  readonly expiresAt: UnixTimeNumber;
}

export type DbxFirebaseStorageFileDownloadUrlPairString = `${UnixTimeNumber}_${StorageFileSignedDownloadUrl}`;

export type DbxFirebaseStorageFileDownloadUrlPairsRecord = Record<StorageFileId, DbxFirebaseStorageFileDownloadUrlPairString>;

export interface DbxFirebaseStorageFileDownloadUserCache {
  readonly uid: FirebaseAuthUserId;
  readonly pairs: DbxFirebaseStorageFileDownloadUrlPairsRecord;
}

/**
 * Token that corresponds to a StorageAccessor<DbxFirebaseStorageFileDownloadUserCache> that is used by DbxModelViewTrackerStorage.
 */
export const DBX_FIREBASE_STORAGEFILE_DOWNLOAD_STORAGE_ACCESSOR_TOKEN = new InjectionToken('DbxFirebaseStorageFileDownloadStorageAccessor');

/**
 * Used for managing DbxModelViewTrackerEvent storage.
 */
@Injectable()
export class DbxFirebaseStorageFileDownloadStorage {
  static readonly DEFAULT_MAX_DOWNLOAD_URLS = 100;

  readonly authService = inject(DbxFirebaseAuthService);
  readonly storageAccessor = inject<StorageAccessor<DbxFirebaseStorageFileDownloadUserCache>>(DBX_FIREBASE_STORAGEFILE_DOWNLOAD_STORAGE_ACCESSOR_TOKEN);

  addDownloadUrl({ id, downloadUrl, expiresAt }: DbxFirebaseStorageFileDownloadUrlPair): Observable<void> {
    return this.getCurrentUserDownloadCache().pipe(
      mergeMap((cache) => {
        const { uid, pairs: currentPairs } = cache;

        const storageKey = this.getStorageKeyForUid(uid);
        const pairs: DbxFirebaseStorageFileDownloadUrlPairsRecord = {
          ...currentPairs,
          [id]: `${expiresAt}_${downloadUrl}`
        };

        return this.storageAccessor.set(storageKey, {
          uid,
          pairs
        });
      }),
      first()
    );
  }

  /**
   * Returns the cached download URL pair for the given key.
   *
   * The pair may be expired.
   *
   * @param key
   * @returns
   */
  getDownloadUrlPair(input: FirestoreModelIdInput): Observable<DbxFirebaseStorageFileDownloadUrlPair | undefined> {
    const id = firestoreModelId(input);
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        return this.getUserDownloadCache(uid).pipe(
          map((cache) => {
            const pair = cache?.pairs[id];

            let result: DbxFirebaseStorageFileDownloadUrlPair | undefined;

            if (pair) {
              const [expiresAt, downloadUrl] = pair.split('_', 2);

              result = {
                id,
                downloadUrl,
                expiresAt: Number(expiresAt)
              };
            }

            return result;
          })
        );
      }),
      first()
    );
  }

  getAllDownloadUrlPairsRecord(uid: FirebaseAuthUserId): Observable<DbxFirebaseStorageFileDownloadUrlPairsRecord> {
    return this.getUserDownloadCache(uid).pipe(map((x) => x.pairs));
  }

  getCurrentUserDownloadCache(): Observable<DbxFirebaseStorageFileDownloadUserCache> {
    return this.authService.uid$.pipe(switchMap((uid) => this.getUserDownloadCache(uid)));
  }

  getUserDownloadCache(uid: FirebaseAuthUserId): Observable<DbxFirebaseStorageFileDownloadUserCache> {
    const storageKey = this.getStorageKeyForUid(uid);
    return this._getUserDownloadCacheForStorageKey(storageKey, uid);
  }

  clearCurrentUserDownloadCache(): Observable<void> {
    return this.authService.uid$.pipe(switchMap((uid) => this.clearUserDownloadCache(uid)));
  }

  clearUserDownloadCache(uid: FirebaseAuthUserId): Observable<void> {
    const storageKey = this.getStorageKeyForUid(uid);
    return this.storageAccessor.remove(storageKey);
  }

  private _getUserDownloadCacheForStorageKey(storageKey: string, uid: FirebaseAuthUserId): Observable<DbxFirebaseStorageFileDownloadUserCache> {
    return this.storageAccessor.get(storageKey).pipe(
      catchError((e) => {
        return of(undefined);
      }),
      map((result) => result ?? { uid, pairs: {} })
    );
  }

  getStorageKeyForUid(uid: FirebaseAuthUserId): string {
    const storageKey = `sf_dl_cache_${uid}`;
    return storageKey;
  }
}
