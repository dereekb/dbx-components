import { inject, Injectable } from '@angular/core';
import { StorageFileFunctions, type DownloadStorageFileOptions, type DownloadStorageFileParams, type StorageFileKey, type StorageFileId, firestoreModelId, firestoreModelKey, storageFileIdentity, type DownloadStorageFileResult } from '@dereekb/firebase';
import { addMilliseconds, type Maybe, type Milliseconds, MS_IN_DAY, MS_IN_HOUR, MS_IN_MINUTE, type Seconds, SECONDS_IN_MINUTE, unixDateTimeSecondsNumberForNow, unixDateTimeSecondsNumberFromDate } from '@dereekb/util';
import { type DbxFirebaseStorageFileDownloadCacheKey, DbxFirebaseStorageFileDownloadStorage, type DbxFirebaseStorageFileDownloadUrlPair } from './storagefile.download.storage.service';
import { first, firstValueFrom, from, interval, map, type Observable, of, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { type LoadingState, throwErrorFromLoadingStateError, valueFromFinishedLoadingState } from '@dereekb/rxjs';

/**
 * Options a StorageFile's download url is minted with, beyond its expiration — which the service owns, so it can
 * cache the result.
 *
 * Urls minted with different options are different urls: an `inline` url renders a PDF where an `attachment` url
 * downloads it. The service caches one url per variant (see {@link dbxFirebaseStorageFileDownloadCacheKey}).
 */
export type DbxFirebaseStorageFileDownloadOptions = Pick<DownloadStorageFileOptions, 'responseDisposition' | 'responseContentType'>;

/**
 * The cache key a StorageFile's download url is stored under for the given options.
 *
 * The bare StorageFileId when no options are set, so urls cached before options existed are still found.
 *
 * @param storageFileId - The StorageFile the url is for.
 * @param options - The options the url is minted with.
 * @returns The cache key.
 */
export function dbxFirebaseStorageFileDownloadCacheKey(storageFileId: StorageFileId, options?: Maybe<DbxFirebaseStorageFileDownloadOptions>): DbxFirebaseStorageFileDownloadCacheKey {
  const responseDisposition = options?.responseDisposition;
  const responseContentType = options?.responseContentType;
  return responseDisposition || responseContentType ? `${storageFileId}|${responseDisposition ?? ''}|${responseContentType ?? ''}` : storageFileId;
}

export type DbxFirebaseStorageFileDownloadServiceCustomSourceDownloadFunction = (params: DownloadStorageFileParams, storageFileId: StorageFileId) => Promise<DownloadStorageFileResult>;

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
  downloadStorageFileResult: DbxFirebaseStorageFileDownloadServiceCustomSourceDownloadFunction;
}

/**
 * Creates a {@link DbxFirebaseStorageFileDownloadServiceCustomSource} from a function that returns a LoadingState observable.
 *
 * @param obsForInput - Function that produces a LoadingState observable for the given download params and storage file ID.
 * @returns A custom source adapter that bridges observable-based downloads to the promise-based interface.
 */
export function dbxFirebaseStorageFileDownloadServiceCustomSourceFromObs(obsForInput: (params: DownloadStorageFileParams, storageFileId: StorageFileId) => Observable<LoadingState<DownloadStorageFileResult>>): DbxFirebaseStorageFileDownloadServiceCustomSource {
  return {
    downloadStorageFileResult: (params: DownloadStorageFileParams, storageFileId: StorageFileId) => firstValueFrom(obsForInput(params, storageFileId).pipe(throwErrorFromLoadingStateError(), valueFromFinishedLoadingState())) as Promise<DownloadStorageFileResult>
  };
}

/**
 * Service used for retrieving download links for StorageFiles.
 */
@Injectable()
export class DbxFirebaseStorageFileDownloadService {
  /**
   * Expiration duration for cached download URLs.
   */
  protected _expiresAfterTime: Milliseconds = MS_IN_HOUR * 12;

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
   * @param storageFileIdOrKey - The StorageFile to read the cached url for.
   * @param options - The options the url was minted with. Each variant is cached separately.
   * @returns Observable of the cached pair, which emits null once it expires.
   */
  getCachedDownloadPairForStorageFile(storageFileIdOrKey: StorageFileId | StorageFileKey, options?: Maybe<DbxFirebaseStorageFileDownloadOptions>): Observable<Maybe<DbxFirebaseStorageFileDownloadUrlPair>> {
    const storageFileId = firestoreModelId(storageFileIdOrKey);
    return this.storageFileDownloadStorage.getDownloadUrlPair(storageFileId, dbxFirebaseStorageFileDownloadCacheKey(storageFileId, options)).pipe(
      switchMap((pair) => {
        let result: Observable<Maybe<DbxFirebaseStorageFileDownloadUrlPair>>;

        if (pair) {
          const expiresAt = pair.expiresAt - this._expiresAfterTimeBuffer;

          function pairIfNotExpired(): Maybe<DbxFirebaseStorageFileDownloadUrlPair> {
            const now = unixDateTimeSecondsNumberForNow();
            const isExpired = now > expiresAt;
            return isExpired ? null : pair;
          }

          const initialPair = pairIfNotExpired();

          if (initialPair) {
            // every minute emit the result again
            result = interval(MS_IN_MINUTE).pipe(
              map(pairIfNotExpired),
              first((x) => x == null), // only emit the first null value
              startWith(initialPair), // send the initial value first
              shareReplay(1)
            );
          } else {
            result = of(null);
          }
        } else {
          result = of(null);
        }

        return result;
      })
    );
  }

  /**
   * Retrieves the download URL for the StorageFile using the default source.
   *
   * These URLs are cached locally to prevent extra/redundant calls to the server.
   *
   * @param storageFileIdOrKey - The StorageFile to download.
   * @param options - Options to mint the url with. Each variant is cached separately.
   * @returns Observable that emits the cached or freshly downloaded URL pair.
   */
  downloadPairForStorageFile(storageFileIdOrKey: StorageFileId | StorageFileKey, options?: Maybe<DbxFirebaseStorageFileDownloadOptions>): Observable<DbxFirebaseStorageFileDownloadUrlPair> {
    return this.downloadPairForStorageFileUsingSource(storageFileIdOrKey, undefined, options);
  }

  /**
   * Retrieves the download URL for the StorageFile using the default parameters and pulled from the input source, if applicable.
   *
   * If no source is provided, uses the default internal source.
   *
   * These URLs are cached locally to prevent extra/redundant calls to the server.
   *
   * @param storageFileIdOrKey - The storage file ID or key to download.
   * @param source - Optional custom download source. Falls back to the default internal source if not provided.
   * @param options - Options to mint the url with, passed to the source in its params. Each variant is cached separately.
   * @returns Observable that emits the cached or freshly downloaded URL pair.
   */
  downloadPairForStorageFileUsingSource(storageFileIdOrKey: StorageFileId | StorageFileKey, source: Maybe<DbxFirebaseStorageFileDownloadServiceCustomSource>, options?: Maybe<DbxFirebaseStorageFileDownloadOptions>): Observable<DbxFirebaseStorageFileDownloadUrlPair> {
    const storageFileId = firestoreModelId(storageFileIdOrKey);
    const obs: Observable<DbxFirebaseStorageFileDownloadUrlPair> = this.getCachedDownloadPairForStorageFile(storageFileId, options).pipe(
      switchMap((cachedPair) => {
        let result: Observable<DbxFirebaseStorageFileDownloadUrlPair>;

        const downloadAndCacheResult = () => {
          return from(this._createDownloadPairForStorageFileUsingSource(source, storageFileIdOrKey, options ?? undefined)).pipe(
            tap((downloadUrlPair) => {
              this.addPairForStorageFileToCache(downloadUrlPair, options);
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
   *
   * @param downloadUrlPair - The download URL pair to store in the local cache.
   * @param options - The options the url was minted with. Each variant is cached separately.
   */
  addPairForStorageFileToCache(downloadUrlPair: DbxFirebaseStorageFileDownloadUrlPair, options?: Maybe<DbxFirebaseStorageFileDownloadOptions>): void {
    this.storageFileDownloadStorage.addDownloadUrl(downloadUrlPair, dbxFirebaseStorageFileDownloadCacheKey(downloadUrlPair.id, options)).pipe(first()).subscribe();
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
      expiresAt,
      key: firestoreModelKey(storageFileIdentity, storageFileId)
    };

    return source.downloadStorageFileResult(params, storageFileId).then((x) => {
      return {
        id: storageFileId,
        downloadUrl: x.url,
        mimeType: x.mimeType,
        expiresAt: x.expiresAt ?? unixDateTimeSecondsNumberFromDate(expiresAt)
      };
    });
  }
}
