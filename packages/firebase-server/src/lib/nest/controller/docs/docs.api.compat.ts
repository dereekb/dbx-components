/**
 * Backward-compatible re-export of the docs API wire contract.
 *
 * The paths, param/result types, error codes and search limits moved to `@dereekb/firebase` (v14.27) so
 * `@dereekb/dbx-cli` can share them without depending on `@dereekb/firebase-server`. Import them from
 * `@dereekb/firebase` going forward.
 */
// eslint-disable-next-line dereekb-util/no-sister-re-export -- backward-compatible facade: the docs API wire contract moved to @dereekb/firebase (v14.27) so @dereekb/dbx-cli can share it; downstream specs still import it from here
export {
  DOCS_API_PATH,
  type DocsManifestSection,
  type DocsSectionSummary,
  type DocsListEntry,
  type DocsListResult,
  type DocsSearchParams,
  type DocsSearchResultEntry,
  type DocsSearchResult,
  type DocsReadParams,
  type DocsReadResult,
  DOCS_NOT_FOUND_ERROR_CODE,
  DOCS_SECTION_NOT_FOUND_ERROR_CODE,
  DEFAULT_DOCS_SEARCH_LIMIT,
  MAX_DOCS_SEARCH_LIMIT
} from '@dereekb/firebase';
