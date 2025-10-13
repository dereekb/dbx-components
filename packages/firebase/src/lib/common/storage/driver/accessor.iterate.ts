import { Maybe, PromiseOrValue } from '@dereekb/util';
import { FirebaseStorageAccessorFolder, StorageListFilesOptions, StorageListFilesResult } from './accessor';
import { FetchPageFactory, fetchPageFactory, FetchPageFactoryInputOptions, FetchPageResult, iterateFetchPages, iterateFetchPagesByEachItem, IterateFetchPagesByEachItemConfig, IterateFetchPagesConfigWithFactoryAndInput, ReadFetchPageResultInfo } from '@dereekb/util/fetch';

// MARK: IterateStorageListFilesFactory
/**
 * Configuration for iterateStorageListFilesFactory()
 */
export type IterateStorageListFilesFactoryConfig = Omit<StorageListFilesOptions, 'pageToken'>;

export interface IterateStorageListFilesInput extends StorageListFilesOptions {
  /**
   * The folder to iterate in.
   */
  readonly folder: FirebaseStorageAccessorFolder;
}

/**
 * A FetchPageFactory that iterates through the files in a storage folder.
 */
export type IterateStorageListFilesFactory = FetchPageFactory<IterateStorageListFilesInput, StorageListFilesResult>;

/**
 * Creates a new IterateStorageListFilesFactory.
 *
 * @param config
 * @returns
 */
export function iterateStorageListFilesFactory(config: IterateStorageListFilesFactoryConfig): IterateStorageListFilesFactory {
  const { maxResults: factoryDefaultMaxResults } = config;

  return fetchPageFactory<IterateStorageListFilesInput, StorageListFilesResult>({
    fetch: async (input: IterateStorageListFilesInput) => {
      const list = await input.folder.list({
        includeNestedResults: input.includeNestedResults,
        maxResults: input.maxResults ?? factoryDefaultMaxResults,
        pageToken: input.pageToken ?? undefined
      });

      return list;
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
    buildInputForNextPage: function (pageResult: Partial<FetchPageResult<StorageListFilesResult<unknown>>>, input: IterateStorageListFilesInput, options: FetchPageFactoryInputOptions): PromiseOrValue<Maybe<Partial<IterateStorageListFilesInput>>> {
      return {
        ...input,
        pageToken: pageResult.nextPageCursor ?? undefined
      };
    }
  });
}

// MARK: Iterate Each File
export type IterateStorageListFilesByEachFileConfig<T, R> = Omit<IterateFetchPagesByEachItemConfig<IterateStorageListFilesInput, StorageListFilesResult, T, R>, 'fetchPageFactory'> & Pick<IterateStorageListFilesInput, 'folder' | 'includeNestedResults' | 'pageToken'>;

/**
 * Convenience function for calling iterateFetchPagesByEachItem() for a storage folder.
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
export type IterateStorageListFilesConfig<R> = Omit<IterateFetchPagesConfigWithFactoryAndInput<IterateStorageListFilesInput, StorageListFilesResult, R>, 'fetchPageFactory'> & Pick<IterateStorageListFilesInput, 'folder' | 'includeNestedResults' | 'pageToken'>;

/**
 * Convenience function for calling iterateFetchPages() for a storage folder.
 */
export function iterateStorageListFiles<R>(input: IterateStorageListFilesConfig<R>) {
  const { folder, includeNestedResults, pageToken } = input;
  return iterateFetchPages<IterateStorageListFilesInput, StorageListFilesResult, R>({
    ...input,
    input: { folder, includeNestedResults, pageToken },
    fetchPageFactory: iterateStorageListFilesFactory({})
  });
}
