import { type Maybe } from '@dereekb/util';

// MARK: Paths
/**
 * Path (relative to the API base URL) of the docs API.
 *
 * Under the `/api` global route prefix the routes are `GET /api/docs`, `GET /api/docs/search?q=&limit=` and
 * `GET /api/docs/read?id=&section=`.
 */
export const DOCS_API_PATH = '/docs';

/**
 * Path (relative to the API base URL) of the docs search route.
 */
export const DOCS_API_SEARCH_PATH = `${DOCS_API_PATH}/search`;

/**
 * Path (relative to the API base URL) of the docs read route.
 */
export const DOCS_API_READ_PATH = `${DOCS_API_PATH}/read`;

/**
 * Query parameter of the docs search route that carries the keyword query.
 */
export const DOCS_API_SEARCH_QUERY_PARAM = 'q';

/**
 * Query parameter of the docs search route that carries the optional result limit.
 */
export const DOCS_API_SEARCH_LIMIT_QUERY_PARAM = 'limit';

/**
 * Query parameter of the docs read route that carries the doc id. Doc ids contain `/`, so they travel as a query
 * parameter instead of a path segment.
 */
export const DOCS_API_READ_ID_QUERY_PARAM = 'id';

/**
 * Query parameter of the docs read route that carries the optional section id.
 */
export const DOCS_API_READ_SECTION_QUERY_PARAM = 'section';

// MARK: Error Codes
/**
 * Error code for a doc that does not exist OR that the caller may not see. Both cases share one 404 so a caller
 * cannot probe for hidden doc ids.
 */
export const DOCS_NOT_FOUND_ERROR_CODE = 'DOCS_NOT_FOUND';

/**
 * Error code for a section id that a visible doc does not have.
 */
export const DOCS_SECTION_NOT_FOUND_ERROR_CODE = 'DOCS_SECTION_NOT_FOUND';

// MARK: Limits
/**
 * Default number of search results.
 */
export const DEFAULT_DOCS_SEARCH_LIMIT = 8;

/**
 * Maximum number of search results.
 */
export const MAX_DOCS_SEARCH_LIMIT = 50;

// MARK: Results
/**
 * One section (H2/H3 heading) of a doc.
 */
export interface DocsManifestSection {
  readonly id: string;
  readonly title: string;
  readonly depth: 2 | 3;
}

/**
 * A section heading as returned by the docs API.
 */
export type DocsSectionSummary = Pick<DocsManifestSection, 'id' | 'title'>;

/**
 * One doc in a {@link DocsListResult}.
 */
export interface DocsListEntry {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly sections: readonly DocsManifestSection[];
}

/**
 * Result of `GET /api/docs`: the docs visible to the caller.
 */
export interface DocsListResult {
  readonly docs: readonly DocsListEntry[];
}

/**
 * Input of the docs search (`GET /api/docs/search`).
 */
export interface DocsSearchParams {
  readonly query: string;
  readonly limit?: Maybe<number>;
}

/**
 * One search hit: a doc (no `section`) or one of its sections.
 */
export interface DocsSearchResultEntry {
  readonly id: string;
  readonly title: string;
  readonly section?: DocsSectionSummary;
  /**
   * The doc's manifest description. Present on doc hits only.
   */
  readonly description?: string;
}

/**
 * Result of `GET /api/docs/search`.
 */
export interface DocsSearchResult {
  readonly total: number;
  readonly results: readonly DocsSearchResultEntry[];
  /**
   * True when no doc matched every query word, so {@link results} match only some of them. Omitted otherwise.
   */
  readonly partial?: boolean;
}

/**
 * Input of the docs read (`GET /api/docs/read`).
 */
export interface DocsReadParams {
  readonly id: string;
  /**
   * A section id from the doc's `sections`. Reads the whole doc when unset.
   */
  readonly section?: Maybe<string>;
}

/**
 * Result of `GET /api/docs/read`.
 */
export interface DocsReadResult {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly section?: DocsSectionSummary;
  /**
   * The doc's sections. Present when the whole doc was read.
   */
  readonly sections?: readonly DocsSectionSummary[];
  /**
   * The markdown (frontmatter removed).
   */
  readonly content: string;
  /**
   * True when the content was cut at the configured maximum read length.
   */
  readonly truncated?: boolean;
}

// MARK: Path Builders
/**
 * Returns the search path (relative to the API base URL) for a query.
 *
 * @param params - The query and optional limit. A null limit is omitted, so the server applies {@link DEFAULT_DOCS_SEARCH_LIMIT}.
 * @returns The path, e.g. `/docs/search?q=guestbook+signing&limit=3`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function docsApiSearchPath(params: DocsSearchParams): string {
  const search = new URLSearchParams({ [DOCS_API_SEARCH_QUERY_PARAM]: params.query });

  if (params.limit != null) {
    search.set(DOCS_API_SEARCH_LIMIT_QUERY_PARAM, String(params.limit));
  }

  return `${DOCS_API_SEARCH_PATH}?${search.toString()}`;
}

/**
 * Returns the read path (relative to the API base URL) for a doc, or one of its sections.
 *
 * @param params - The doc id and optional section id. An empty or null section is omitted, so the whole doc is read.
 * @returns The path, e.g. `/docs/read?id=guestbook%2Fsigning&section=overview`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function docsApiReadPath(params: DocsReadParams): string {
  const search = new URLSearchParams({ [DOCS_API_READ_ID_QUERY_PARAM]: params.id });

  if (params.section) {
    search.set(DOCS_API_READ_SECTION_QUERY_PARAM, params.section);
  }

  return `${DOCS_API_READ_PATH}?${search.toString()}`;
}
