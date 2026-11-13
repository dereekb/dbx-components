import { type Maybe } from '@dereekb/util';
import { type FetchPageFactory, type FetchPageFactoryConfigDefaults, fetchPageFactory, iterateFetchPages } from '@dereekb/util/fetch';
import { type MicrosoftGraphRequestInput, microsoftGraphRequest } from './graph.api';
import { type MicrosoftGraphContext } from './graph.config';
import { type MicrosoftGraphPage } from './graph.type';

/**
 * Default number of pages a Graph collection read follows before it stops.
 */
export const DEFAULT_MICROSOFT_GRAPH_MAX_PAGES = 20;

/**
 * One page of a Graph collection GET: the first page by `path` + `query`, or a later page by its `@odata.nextLink`.
 */
export interface MicrosoftGraphPageInput extends Omit<MicrosoftGraphRequestInput, 'method' | 'body'> {
  /**
   * The absolute `@odata.nextLink` to continue from. Replaces `path` and `query`, which the link already carries.
   */
  readonly nextLink?: Maybe<string>;
}

/**
 * Creates a {@link FetchPageFactory} over a Graph collection that follows `@odata.nextLink`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @param defaults - Optional page defaults. `defaultMaxPage` is a 0-based page index; it defaults to reading
 *   {@link DEFAULT_MICROSOFT_GRAPH_MAX_PAGES} pages.
 * @returns The page factory.
 */
export function microsoftGraphFetchPageFactory<T>(context: MicrosoftGraphContext, defaults?: Maybe<FetchPageFactoryConfigDefaults>): FetchPageFactory<MicrosoftGraphPageInput, MicrosoftGraphPage<T>> {
  const request = microsoftGraphRequest(context);

  return fetchPageFactory<MicrosoftGraphPageInput, MicrosoftGraphPage<T>>({
    // maxPage is the last page INDEX to load (the first page is 0), so a count of N pages is N - 1
    defaultMaxPage: DEFAULT_MICROSOFT_GRAPH_MAX_PAGES - 1,
    ...defaults,
    fetch: (input) => request<MicrosoftGraphPage<T>>({ method: 'GET', path: input.nextLink ?? input.path, query: input.nextLink ? undefined : input.query, headers: input.headers }),
    readFetchPageResultInfo: (result) => {
      const nextLink = result['@odata.nextLink'];
      return { nextPageCursor: nextLink, hasNext: Boolean(nextLink) };
    },
    buildInputForNextPage: (pageResult, input) => (pageResult.nextPageCursor ? { ...input, nextLink: pageResult.nextPageCursor } : undefined)
  });
}

/**
 * Input for {@link microsoftGraphCollectPages}.
 */
export interface MicrosoftGraphCollectPagesInput extends MicrosoftGraphPageInput {
  /**
   * Stops after this many pages. Defaults to {@link DEFAULT_MICROSOFT_GRAPH_MAX_PAGES}.
   */
  readonly maxPages?: Maybe<number>;
}

/**
 * The items of every page read, plus the link to the next unread page when the read stopped at `maxPages`.
 */
export interface MicrosoftGraphCollectPagesResult<T> {
  readonly items: T[];
  readonly pageCount: number;
  /**
   * Set when more pages remain: pass it back as `nextLink` to continue.
   */
  readonly nextLink?: Maybe<string>;
}

/**
 * Reads a Graph collection page by page through {@link microsoftGraphFetchPageFactory}, up to `maxPages`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that collects the items and reports the next unread page's link.
 */
export function microsoftGraphCollectPages(context: MicrosoftGraphContext): <T = unknown>(input: MicrosoftGraphCollectPagesInput) => Promise<MicrosoftGraphCollectPagesResult<T>> {
  return async <T>(input: MicrosoftGraphCollectPagesInput) => {
    const { maxPages, ...pageInput } = input;
    const items: T[] = [];
    let pageCount = 0;
    let nextLink: Maybe<string>;

    await iterateFetchPages({
      input: pageInput,
      fetchPageFactory: microsoftGraphFetchPageFactory<T>(context),
      maxPage: Math.max(1, maxPages ?? DEFAULT_MICROSOFT_GRAPH_MAX_PAGES) - 1,
      // each page's link comes from the one before, and items must keep their order
      maxParallelPages: 1,
      iteratePage: async (pageResult) => {
        items.push(...(pageResult.result.value ?? []));
        pageCount += 1;
        nextLink = pageResult.result['@odata.nextLink'];
      }
    });

    return { items, pageCount, nextLink };
  };
}

/**
 * Input for {@link microsoftGraphRequestAllPages}.
 */
export type MicrosoftGraphRequestAllPagesInput = MicrosoftGraphCollectPagesInput;

/**
 * GETs a Graph collection and follows `@odata.nextLink` until the last page (or `maxPages`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that follows `@odata.nextLink` (up to `maxPages`) and resolves the collected items.
 */
export function microsoftGraphRequestAllPages(context: MicrosoftGraphContext): <T = unknown>(input: MicrosoftGraphRequestAllPagesInput) => Promise<T[]> {
  const collect = microsoftGraphCollectPages(context);
  return async <T>(input: MicrosoftGraphRequestAllPagesInput) => (await collect<T>(input)).items;
}
