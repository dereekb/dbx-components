import { cachedGetter, type Maybe } from '@dereekb/util';
import { type StorageListFilesPageToken, type FirebaseStorageAccessorFile, type FirebaseStorageAccessorFolder, type StorageListFileResult, type StorageListFilesOptions, type StorageListFilesResult, type StorageListFolderResult, type StorageListItemResult } from './accessor';

/**
 * Delegate that adapts platform-specific list results into the generic {@link StorageListFilesResult} interface.
 *
 * Implementations extract items, pagination tokens, and convert raw results into typed file/folder accessors.
 * Used by {@link storageListFilesResultFactory} to create the normalized result objects.
 *
 * @template S - the storage instance type (client or server SDK)
 * @template R - the raw list result type from the underlying SDK
 */
export interface StorageListFilesResultFactoryDelegate<S, R> {
  hasItems(result: R): boolean;
  hasNext(result: R): boolean;
  nextPageTokenFromResult(result: R): Maybe<StorageListFilesPageToken>;
  next(storage: S, options: StorageListFilesOptions | undefined, folder: FirebaseStorageAccessorFolder, result: R): Promise<StorageListFilesResult>;
  file(storage: S, fileResult: StorageListItemResult): FirebaseStorageAccessorFile;
  folder(storage: S, folderResult: StorageListItemResult): FirebaseStorageAccessorFolder;
  filesFromResult(result: R, folder: FirebaseStorageAccessorFolder): StorageListItemResult[];
  foldersFromResult(result: R, folder: FirebaseStorageAccessorFolder): StorageListItemResult[];
}

/**
 * Factory function that transforms a raw SDK list result into a normalized {@link StorageListFilesResult}.
 */
export type StorageListFilesResultFactory<S, R> = (storage: S, folder: FirebaseStorageAccessorFolder, options: StorageListFilesOptions | undefined, result: R) => StorageListFilesResult;

/**
 * Creates a {@link StorageListFilesResultFactory} from a platform-specific delegate.
 *
 * The returned factory lazily computes file and folder arrays (via {@link cachedGetter}) and
 * provides cursor-based pagination through the `next()` method.
 *
 * @param delegate - platform-specific implementation for extracting results
 *
 * @example
 * ```ts
 * const factory = storageListFilesResultFactory(myDelegate);
 * const result = factory(storage, folder, { maxResults: 50 }, rawSdkResult);
 * const files = result.files();
 * ```
 */
export function storageListFilesResultFactory<S, R>(delegate: StorageListFilesResultFactoryDelegate<S, R>): StorageListFilesResultFactory<S, R> {
  return (storage: S, folder: FirebaseStorageAccessorFolder, options: StorageListFilesOptions | undefined, result: R) => {
    function fileResult(item: StorageListItemResult): StorageListFileResult {
      (item as StorageListFileResult).file = () => delegate.file(storage, item);
      return item as StorageListFileResult;
    }

    function folderResult(item: StorageListItemResult): StorageListFolderResult {
      (item as StorageListFolderResult).folder = () => delegate.folder(storage, item);
      return item as StorageListFolderResult;
    }

    const hasNext = delegate.hasNext(result);

    const next: () => Promise<StorageListFilesResult> = cachedGetter(() => {
      if (!hasNext) {
        throw storageListFilesResultHasNoNextError();
      }

      return delegate.next(storage, options, folder, result);
    });

    const files: () => StorageListFileResult[] = cachedGetter(() => delegate.filesFromResult(result, folder).map(fileResult));
    const folders: () => StorageListFolderResult[] = cachedGetter(() => delegate.foldersFromResult(result, folder).map(folderResult));
    const nextPageToken: () => Maybe<StorageListFilesPageToken> = cachedGetter(() => delegate.nextPageTokenFromResult(result));

    const filesResult: StorageListFilesResult = {
      raw: result,
      options,
      hasNext,
      hasItems: () => delegate.hasItems(result),
      next,
      files,
      folders,
      nextPageToken
    };

    return filesResult;
  };
}

/**
 * Creates an error thrown when `next()` is called on a list result that has no more pages.
 */
export function storageListFilesResultHasNoNextError() {
  return new Error('hasNext is false, there are no more results available.');
}
