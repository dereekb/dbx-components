import { type DocsManifestEntry } from './docs.api.manifest';

// MARK: Dynamic Docs
/**
 * A doc built in code rather than read from the docs folder. A {@link DynamicDocsSource} contributes it, and
 * `DocsApiService` serves it next to the file docs under the same checks.
 */
export interface DynamicDocsEntry extends Pick<DocsManifestEntry, 'title' | 'description' | 'tags' | 'audience'> {
  /**
   * The id clients read the doc by (e.g. `requirements/index`). An id a file doc or an earlier dynamic doc already took
   * is skipped with a warning.
   */
  readonly id: string;
  /**
   * The doc's markdown. Its H2/H3 headings outside fenced code become the doc's sections (see
   * `extractDocsMarkdownSections`). Like a doc file's, a leading `---` frontmatter block is not served; set the
   * metadata on this entry instead.
   */
  readonly content: string;
}

/**
 * Contributes {@link DynamicDocsEntry} values to the docs API.
 *
 * `loadDocs` is called once, lazily, on the first docs request; its docs are served until the server restarts. A source
 * can render docs from data bundled with the app or from a JSON file it reads at that point. When it throws, the error is
 * logged and the source serves no docs.
 */
export interface DynamicDocsSource {
  /**
   * Name used in log lines.
   */
  readonly name: string;
  readonly loadDocs: () => readonly DynamicDocsEntry[];
}

/**
 * Injection token for the app's {@link DynamicDocsSource} array. Optional: without it the docs API serves only the file
 * docs. Provide AND export it from the docs module's dependency module.
 */
export const DYNAMIC_DOCS_SOURCES = 'DYNAMIC_DOCS_SOURCES';
