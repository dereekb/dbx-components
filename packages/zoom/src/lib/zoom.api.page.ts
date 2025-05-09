import { Maybe, PageNumber, PromiseOrValue, getNextPageNumber } from '@dereekb/util';
import { fetchPageFactory, ReadFetchPageResultInfo, FetchPageResult, FetchPageFactoryInputOptions, FetchPageFactoryConfigDefaults } from '@dereekb/util/fetch';

/**
 * Base page filter
 */
export interface ZoomPageFilter {
  readonly page?: number;
  readonly per_page?: number;
}
