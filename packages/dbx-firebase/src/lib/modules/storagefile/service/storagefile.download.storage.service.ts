import { Injectable, InjectionToken, inject } from '@angular/core';
import { StorageAccessor } from '@dereekb/dbx-core';
import { map, mergeMap, catchError, Observable, of, switchMap, first } from 'rxjs';
import { FirebaseAuthUserId, StorageFileKey, StorageFileSignedDownloadUrl } from '@dereekb/firebase';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { UnixTimeNumber } from '@dereekb/util';

export interface DbxFirebaseStorageFileDownloadUrlPair {
  readonly key: StorageFileKey;
  readonly downloadUrl: StorageFileSignedDownloadUrl;
  /**
   * Expiration in seconds since epoch.
   */
  readonly expiresAt: UnixTimeNumber;
}

export type DbxFirebaseStorageFileDownloadUrlPairString = `${UnixTimeNumber}_${StorageFileSignedDownloadUrl}`;

export type DbxFirebaseStorageFileDownloadUrlPairsRecord = Record<StorageFileKey, DbxFirebaseStorageFileDownloadUrlPairString>;

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

  addDownloadUrl({ key, downloadUrl, expiresAt }: DbxFirebaseStorageFileDownloadUrlPair): Observable<void> {
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        const storageKey = this.getStorageKeyForUid(uid);

        return this.storageAccessor.get(storageKey).pipe(
          mergeMap((cache) => {
            const pairs: DbxFirebaseStorageFileDownloadUrlPairsRecord = {
              ...(cache?.pairs ?? {}),
              [key]: `${expiresAt}_${downloadUrl}`
            };

            return this.storageAccessor.set(storageKey, {
              uid: uid,
              pairs
            });
          })
        );
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
  getDownloadUrlPair(key: StorageFileKey): Observable<DbxFirebaseStorageFileDownloadUrlPair | undefined> {
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        const storageKey = this.getStorageKeyForUid(uid);
        return this.storageAccessor.get(storageKey).pipe(
          map((cache) => {
            const pair = cache?.pairs[key];

            let result: DbxFirebaseStorageFileDownloadUrlPair | undefined;

            if (pair) {
              const [expiresAt, downloadUrl] = pair.split('_', 2);

              result = {
                key,
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

  getUserDownloadCache(uid: FirebaseAuthUserId): Observable<DbxFirebaseStorageFileDownloadUserCache> {
    const storageKey = this.getStorageKeyForUid(uid);
    return this._getUserDownloadCacheForStorageKey(storageKey, uid);
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
