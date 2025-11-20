import { inject, Injectable } from '@angular/core';
import { StorageFileFunctions, DownloadStorageFileParams, StorageFileKey, StorageFileSignedDownloadUrl } from '@dereekb/firebase';
import { addMilliseconds, MS_IN_DAY, MS_IN_HOUR, MS_IN_MINUTE, unixTimeNumberForNow, unixTimeNumberFromDate } from '@dereekb/util';
import { DbxFirebaseStorageFileDownloadStorage } from './storagefile.download.storage.service';
import { first, firstValueFrom, from, map, Observable, of, switchMap, tap } from 'rxjs';

/**
 * Service used for retrieving download links for StorageFiles.
 */
@Injectable()
export class DbxFirebaseStorageFileDownloadService {
  /**
   * Expiration duration for cached download URLs.
   */
  protected _expiresAfterTime = 3 * MS_IN_DAY;

  /**
   * When reading cached values, this buffer is added to the expiration time to prevent the URL from expiring while it is being used.
   */
  protected _expiresAfterTimeBuffer = MS_IN_MINUTE * 10;

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
   * Retrieves the download URL for the StorageFile using the default parameters.
   *
   * These URLs are cached locally to prevent extra/redundant calls to the server.
   *
   * @param storageFileKey
   * @returns
   */
  downloadUrlForStorageFile(storageFileKey: StorageFileKey): Promise<string> {
    const obs: Observable<StorageFileSignedDownloadUrl> = this.storageFileDownloadStorage.getDownloadUrlPair(storageFileKey).pipe(
      switchMap((pair) => {
        let result: Observable<StorageFileSignedDownloadUrl>;

        const downloadAndCacheResult = () => {
          const expiresAt = addMilliseconds(new Date(), this._expiresAfterTime);
          return from(this.createDownloadUrlForStorageFile(storageFileKey, { expiresAt })).pipe(
            tap((downloadUrl) => {
              // add to the cache
              this.storageFileDownloadStorage
                .addDownloadUrl({
                  key: storageFileKey,
                  downloadUrl,
                  expiresAt: unixTimeNumberFromDate(expiresAt)
                })
                .pipe(first())
                .subscribe();
            })
          );
        };

        if (pair) {
          const expiresAt = pair.expiresAt + this._expiresAfterTimeBuffer;
          const now = unixTimeNumberForNow();

          if (expiresAt > now) {
            result = of(pair.downloadUrl);
          } else {
            // if expired, then download and cache the result
            result = downloadAndCacheResult();
          }
        } else {
          result = downloadAndCacheResult();
        }

        return result;
      })
    );

    return firstValueFrom(obs);
  }

  /**
   * Creates a new download URL for the StorageFile.
   *
   * @param storageFileKey
   * @param inputParams
   * @returns
   */
  createDownloadUrlForStorageFile(storageFileKey: StorageFileKey, inputParams?: Omit<DownloadStorageFileParams, 'key'>): Promise<StorageFileSignedDownloadUrl> {
    const params: DownloadStorageFileParams = {
      ...inputParams,
      key: storageFileKey
    };

    return this.storageFileFunctions.storageFile.readStorageFile.download(params).then((x) => x.url);
  }
}
