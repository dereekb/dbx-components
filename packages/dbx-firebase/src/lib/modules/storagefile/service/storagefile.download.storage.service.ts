import { Injectable, InjectionToken, inject } from '@angular/core';
import { type StorageAccessor } from '@dereekb/dbx-core';
import { map, mergeMap, catchError, type Observable, of, switchMap, first } from 'rxjs';
import { type FirebaseAuthUserId, firestoreModelId, type FirestoreModelIdInput, type StorageFileId, type StorageFileSignedDownloadUrl } from '@dereekb/firebase';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { type ContentTypeMimeType, type Maybe, splitJoinRemainder, type UnixDateTimeSecondsNumber } from '@dereekb/util';

export interface DbxFirebaseStorageFileDownloadUrlPair {
  readonly id: StorageFileId;
  readonly downloadUrl: StorageFileSignedDownloadUrl;
  /**
   * Mime type, if available.
   */
  readonly mimeType?: Maybe<ContentTypeMimeType>;
  /**
   * Expiration in seconds since epoch.
   */
  readonly expiresAt: UnixDateTimeSecondsNumber;
}

export type DbxFirebaseStorageFileDownloadUrlPairString = `${UnixDateTimeSecondsNumber}_${StorageFileSignedDownloadUrl}`;

/**
 * Key a cached download url is stored under.
 *
 * The StorageFileId for a url minted with the default options, and a variant of it for a url minted with others —
 * see `dbxFirebaseStorageFileDownloadCacheKey()`.
 */
export type DbxFirebaseStorageFileDownloadCacheKey = string;

export type DbxFirebaseStorageFileDownloadUrlPairsRecord = Record<DbxFirebaseStorageFileDownloadCacheKey, DbxFirebaseStorageFileDownloadUrlPairString>;

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

  /**
   * Caches the download url pair.
   *
   * @param pair - The pair to cache.
   * @param cacheKey - Key to store the pair under. Defaults to the pair's StorageFileId.
   * @returns Observable that completes once the pair is stored.
   */
  addDownloadUrl(pair: DbxFirebaseStorageFileDownloadUrlPair, cacheKey?: Maybe<DbxFirebaseStorageFileDownloadCacheKey>): Observable<void> {
    const { id, downloadUrl, expiresAt, mimeType } = pair;

    return this.getCurrentUserDownloadCache().pipe(
      mergeMap((cache) => {
        const { uid, pairs: currentPairs } = cache;

        const storageKey = this.getStorageKeyForUid(uid);
        const pairs: DbxFirebaseStorageFileDownloadUrlPairsRecord = {
          ...currentPairs,
          [cacheKey ?? id]: `${expiresAt}_${mimeType}_${downloadUrl}`
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
   * @param input - The Firestore model ID or key identifying the storage file.
   * @param cacheKey - Key the pair was stored under. Defaults to the StorageFileId.
   * @returns Observable that emits the cached download URL pair, or undefined if not found.
   */
  getDownloadUrlPair(input: FirestoreModelIdInput, cacheKey?: Maybe<DbxFirebaseStorageFileDownloadCacheKey>): Observable<DbxFirebaseStorageFileDownloadUrlPair | undefined> {
    const id = firestoreModelId(input);
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        return this.getUserDownloadCache(uid).pipe(
          map((cache) => {
            const pair = cache?.pairs[cacheKey ?? id];

            let result: DbxFirebaseStorageFileDownloadUrlPair | undefined;

            if (pair) {
              const [expiresAt, mimeType, downloadUrl] = splitJoinRemainder(pair, '_', 3);

              result = {
                id,
                downloadUrl,
                expiresAt: Number(expiresAt),
                mimeType
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
      catchError((_e) => {
        return of(undefined);
      }),
      map((result) => result ?? { uid, pairs: {} })
    );
  }

  getStorageKeyForUid(uid: FirebaseAuthUserId): string {
    return `sf_dl_cache_${uid}`;
  }
}
