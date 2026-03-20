import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type FirebaseStorageAccessorFolder, type StorageListFilesOptions, type StorageListFilesResult } from './accessor';
import { type FetchPageFactory, fetchPageFactory, type FetchPageFactoryInputOptions, type FetchPageResult, iterateFetchPages, iterateFetchPagesByEachItem, type IterateFetchPagesByEachItemConfig, type IterateFetchPagesConfigWithFactoryAndInput, type ReadFetchPageResultInfo } from '@dereekb/util/fetch';

// MARK: IterateStorageListFilesFactory
/**
 * Configuration for {@link iterateStorageListFilesFactory}. Excludes `pageToken` since it is managed internally during iteration.
 */
export type IterateStorageListFilesFactoryConfig = Omit<StorageListFilesOptions, 'pageToken'>;

/**
 * Input for a single page fetch during storage file iteration.
 */
export interface IterateStorageListFilesInput extends StorageListFilesOptions {
  /**
   * The folder to iterate files within.
   */
  readonly folder: FirebaseStorageAccessorFolder;
}

/**
 * A {@link FetchPageFactory} specialized for paginating through files in a storage folder.
 *
 * Produced by {@link iterateStorageListFilesFactory}.
 */
export type IterateStorageListFilesFactory = FetchPageFactory<IterateStorageListFilesInput, StorageListFilesResult>;

/**
 * Creates an {@link IterateStorageListFilesFactory} for paginated iteration over files in a storage folder.
 *
 * Wraps the folder's `list()` API with cursor-based pagination via {@link fetchPageFactory}.
 *
 * @param config - default listing options (e.g., maxResults)
 * @returns an {@link IterateStorageListFilesFactory} for paginated file listing
 *
 * @example
 * ```ts
 * const factory = iterateStorageListFilesFactory({ maxResults: 100 });
 * ```
 */
export function iterateStorageListFilesFactory(config: IterateStorageListFilesFactoryConfig): IterateStorageListFilesFactory {
  const { maxResults: factoryDefaultMaxResults } = config;

  return fetchPageFactory<IterateStorageListFilesInput, StorageListFilesResult>({
    fetch: async (input: IterateStorageListFilesInput) => {
      return input.folder.list({
        includeNestedResults: input.includeNestedResults,
        maxResults: input.maxResults ?? factoryDefaultMaxResults,
        pageToken: input.pageToken ?? undefined
      });
    },
    readFetchPageResultInfo: (result) => {
      const cursor = result.nextPageToken();

      const info: ReadFetchPageResultInfo = {
        hasNext: result.hasNext,
        cursor: result.options?.pageToken,
        nextPageCursor: cursor
      };

      return info;
    },
    buildInputForNextPage: function (pageResult: Partial<FetchPageResult<StorageListFilesResult<unknown>>>, input: IterateStorageListFilesInput, _options: FetchPageFactoryInputOptions): PromiseOrValue<Maybe<Partial<IterateStorageListFilesInput>>> {
      return {
        ...input,
        pageToken: pageResult.nextPageCursor ?? undefined
      };
    }
  });
}

// MARK: Iterate Each File
/**
 * Configuration for {@link iterateStorageListFilesByEachFile}, extending the per-item iteration config
 * with folder and listing options.
 */
export type IterateStorageListFilesByEachFileConfig<T, R> = Omit<IterateFetchPagesByEachItemConfig<IterateStorageListFilesInput, StorageListFilesResult, T, R>, 'fetchPageFactory'> & Pick<IterateStorageListFilesInput, 'folder' | 'includeNestedResults' | 'pageToken'>;

/**
 * Iterates through every file in a storage folder, invoking a callback for each individual file result.
 *
 * Convenience wrapper around {@link iterateFetchPagesByEachItem} pre-configured for storage listing.
 *
 * @param input - iteration configuration including folder, listing options, and per-item callback
 * @returns the result of the paginated per-item iteration
 */
export function iterateStorageListFilesByEachFile<T, R>(input: IterateStorageListFilesByEachFileConfig<T, R>) {
  const { folder, includeNestedResults, pageToken } = input;
  return iterateFetchPagesByEachItem<IterateStorageListFilesInput, StorageListFilesResult, T, R>({
    ...input,
    input: { folder, includeNestedResults, pageToken },
    fetchPageFactory: iterateStorageListFilesFactory({})
  });
}

// MARK: Iterate Pages
/**
 * Configuration for {@link iterateStorageListFiles}, extending the page-level iteration config
 * with folder and listing options.
 */
export type IterateStorageListFilesConfig<R> = Omit<IterateFetchPagesConfigWithFactoryAndInput<IterateStorageListFilesInput, StorageListFilesResult, R>, 'fetchPageFactory'> & Pick<IterateStorageListFilesInput, 'folder' | 'includeNestedResults' | 'pageToken'>;

/**
 * Iterates through pages of file results in a storage folder, invoking a callback for each page.
 *
 * Convenience wrapper around {@link iterateFetchPages} pre-configured for storage listing.
 *
 * @param input - iteration configuration including folder, listing options, and per-page callback
 * @returns the result of the paginated page-level iteration
 */
export function iterateStorageListFiles<R>(input: IterateStorageListFilesConfig<R>) {
  const { folder, includeNestedResults, pageToken } = input;
  return iterateFetchPages<IterateStorageListFilesInput, StorageListFilesResult, R>({
    ...input,
    input: { folder, includeNestedResults, pageToken },
    fetchPageFactory: iterateStorageListFilesFactory({})
  });
}
