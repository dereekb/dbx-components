import { inject, Injectable } from '@angular/core';
import { StorageFileFunctions, DownloadStorageFileParams, StorageFileKey, StorageFileId, firestoreModelId, firestoreModelKey, storageFileIdentity, DownloadStorageFileResult } from '@dereekb/firebase';
import { addMilliseconds, Maybe, Milliseconds, MS_IN_DAY, MS_IN_HOUR, MS_IN_MINUTE, Seconds, SECONDS_IN_MINUTE, unixDateTimeSecondsNumberForNow, unixDateTimeSecondsNumberFromDate } from '@dereekb/util';
import { DbxFirebaseStorageFileDownloadStorage, DbxFirebaseStorageFileDownloadUrlPair } from './storagefile.download.storage.service';
import { distinctUntilChanged, filter, first, from, interval, map, Observable, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

/**
 * Used as a custom source for downloading StorageFiles.
 */
export interface DbxFirebaseStorageFileDownloadServiceCustomSource {
  /**
   * Retrieves the download result for the StorageFile using the input parameters.
   *
   * @param storageFileId
   * @returns
   */
  downloadStorageFileResult(params: DownloadStorageFileParams, storageFileId: StorageFileId): Promise<DownloadStorageFileResult>;
}

/**
 * Service used for retrieving download links for StorageFiles.
 */
@Injectable()
export class DbxFirebaseStorageFileDownloadService {
  /**
   * Expiration duration for cached download URLs.
   */
  protected _expiresAfterTime: Milliseconds = 3 * MS_IN_DAY;

  /**
   * When reading cached values, this buffer is added to the expiration time to prevent the URL from expiring while it is being used.
   */
  protected _expiresAfterTimeBuffer: Seconds = SECONDS_IN_MINUTE * 10;

  readonly storageFileFunctions = inject(StorageFileFunctions);
  readonly storageFileDownloadStorage = inject(DbxFirebaseStorageFileDownloadStorage);

  // MARK: Config
  getExpiresAfterTime(): number {
    return this._expiresAfterTime;
  }

  setExpiresAfterTime(expiresAfter: number): void {
    const maxAllowed = MS_IN_DAY * 20;

    if (expiresAfter > maxAllowed) {
      throw new Error(`Expires after time cannot be greater than 20 days.`);
    } else if (expiresAfter < MS_IN_HOUR) {
      throw new Error(`Expires after time cannot be less than 1 hour.`);
    }

    this._expiresAfterTime = expiresAfter;
  }

  // MARK: Download
  /**
   * Returns an observable that returns the cached download URL pair for the StorageFile, and emits null once it expires.
   *
   * @param storageFileIdOrKey
   * @returns
   */
  getCachedDownloadPairForStorageFile(storageFileIdOrKey: StorageFileId | StorageFileKey): Observable<Maybe<DbxFirebaseStorageFileDownloadUrlPair>> {
    const storageFileId = firestoreModelId(storageFileIdOrKey);
    return this.storageFileDownloadStorage.getDownloadUrlPair(storageFileId).pipe(
      switchMap((pair) => {
        let result: Observable<Maybe<DbxFirebaseStorageFileDownloadUrlPair>>;

        if (pair) {
          const expiresAt = pair.expiresAt - this._expiresAfterTimeBuffer;

          // every minute emit the result again
          result = interval(MS_IN_MINUTE)
            .pipe(
              map(() => {
                const now = unixDateTimeSecondsNumberForNow();
                const isExpired = now > expiresAt;
                return isExpired ? null : pair; // emit null once expired
              })
            )
            .pipe(
              filter((x) => x == null),
              first(),
              startWith(pair),
              distinctUntilChanged(),
              shareReplay(1)
            );
        } else {
          result = of(null);
        }

        return result;
      })
    );
  }

  /**
   * Retrieves the download URL for the StorageFile using the default parameters.
   *
   * These URLs are cached locally to prevent extra/redundant calls to the server.
   *
   * @param storageFileIdOrKey
   * @returns
   */
  downloadPairForStorageFile(storageFileIdOrKey: StorageFileId | StorageFileKey): Observable<DbxFirebaseStorageFileDownloadUrlPair> {
    return this.downloadPairForStorageFileUsingSource(storageFileIdOrKey, undefined);
  }

  /**
   * Retrieves the download URL for the StorageFile using the default parameters and pulled from the input source, if applicable.
   *
   * If no source is provided, uses the default internal source.
   *
   * These URLs are cached locally to prevent extra/redundant calls to the server.
   *
   * @param storageFileIdOrKey
   * @returns
   */
  downloadPairForStorageFileUsingSource(storageFileIdOrKey: StorageFileId | StorageFileKey, source: Maybe<DbxFirebaseStorageFileDownloadServiceCustomSource>): Observable<DbxFirebaseStorageFileDownloadUrlPair> {
    const storageFileId = firestoreModelId(storageFileIdOrKey);
    const obs: Observable<DbxFirebaseStorageFileDownloadUrlPair> = this.getCachedDownloadPairForStorageFile(storageFileId).pipe(
      switchMap((cachedPair) => {
        let result: Observable<DbxFirebaseStorageFileDownloadUrlPair>;

        const downloadAndCacheResult = () => {
          const expiresAt = addMilliseconds(new Date(), this._expiresAfterTime);

          return from(this._createDownloadPairForStorageFileUsingSource(source, storageFileIdOrKey, { expiresAt })).pipe(
            tap((downloadUrlPair) => {
              this.addPairForStorageFileToCache(downloadUrlPair);
            })
          );
        };

        if (cachedPair) {
          result = of(cachedPair);
        } else {
          result = downloadAndCacheResult();
        }

        return result;
      }),
      first(),
      shareReplay(1)
    );

    return obs;
  }

  /**
   * Adds the given download URL pair to the cache.
   */
  addPairForStorageFileToCache(downloadUrlPair: DbxFirebaseStorageFileDownloadUrlPair): void {
    this.storageFileDownloadStorage.addDownloadUrl(downloadUrlPair).pipe(first()).subscribe();
  }

  /**
   * Creates a new download URL for the StorageFile.
   *
   * @param storageFileIdOrKey
   * @param inputParams
   * @returns
   */
  createDownloadPairForStorageFile(storageFileIdOrKey: StorageFileId | StorageFileKey, inputParams?: Omit<DownloadStorageFileParams, 'key'>): Promise<DbxFirebaseStorageFileDownloadUrlPair> {
    return this._createDownloadPairForStorageFileUsingSource(undefined, storageFileIdOrKey, inputParams);
  }

  private _createDownloadPairForStorageFileUsingSource(inputSource: Maybe<DbxFirebaseStorageFileDownloadServiceCustomSource>, storageFileIdOrKey: StorageFileId | StorageFileKey, inputParams?: Omit<DownloadStorageFileParams, 'key'>): Promise<DbxFirebaseStorageFileDownloadUrlPair> {
    const source = inputSource ?? {
      downloadStorageFileResult: (params) => this.storageFileFunctions.storageFile.readStorageFile.download(params)
    };

    const storageFileId = firestoreModelId(storageFileIdOrKey);
    const expiresAt = inputParams?.expiresAt ?? addMilliseconds(new Date(), this._expiresAfterTime);

    const params: DownloadStorageFileParams = {
      ...inputParams,
      key: firestoreModelKey(storageFileIdentity, storageFileId)
    };

    return source.downloadStorageFileResult(params, storageFileId).then((x) => {
      return {
        id: storageFileId,
        downloadUrl: x.url,
        expiresAt: unixDateTimeSecondsNumberFromDate(inputParams?.expiresAt ?? addMilliseconds(new Date(), this._expiresAfterTime))
      };
    });
  }
}
