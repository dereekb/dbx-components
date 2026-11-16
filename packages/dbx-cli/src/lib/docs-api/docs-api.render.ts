import { type Maybe } from '@dereekb/util';
import { MAX_DOCS_SEARCH_LIMIT, type DocsListEntry, type DocsListResult, type DocsSearchResult, type DocsSearchResultEntry } from '@dereekb/firebase';
import { DEFAULT_DOCS_API_COMMAND_NAME } from './docs-api.client';

/**
 * Options shared by the docs markdown renderers.
 */
export interface DocsApiRenderOptions {
  /**
   * The CLI's name, used in the footer hints. Defaults to `<cli>`.
   */
  readonly cliName?: Maybe<string>;
  /**
   * The docs group's name, used in the footer hints. Defaults to {@link DEFAULT_DOCS_API_COMMAND_NAME}.
   */
  readonly commandName?: Maybe<string>;
}

/**
 * Options for {@link renderDocsListMarkdown}.
 */
export interface RenderDocsListMarkdownOptions extends DocsApiRenderOptions {
  /**
   * Lists each doc's section ids under it.
   */
  readonly sections?: Maybe<boolean>;
}

/**
 * Options for {@link renderDocsSearchMarkdown}.
 */
export interface RenderDocsSearchMarkdownOptions extends DocsApiRenderOptions {
  readonly query: string;
}

/**
 * Renders the docs the caller may read as a markdown list.
 *
 * @param result - The docs API list result.
 * @param options - The CLI and command names, and whether to list each doc's sections.
 * @returns The markdown.
 * @__NO_SIDE_EFFECTS__
 */
export function renderDocsListMarkdown(result: DocsListResult, options?: Maybe<RenderDocsListMarkdownOptions>): string {
  const docs = docsCommandPrefix(options);
  const lines: string[] = [];

  if (result.docs.length === 0) {
    lines.push('No docs are visible to this login. Docs published to an audience you do not hold are hidden.');
  } else {
    lines.push(`# Docs you can read (${result.docs.length})`, '');

    for (const doc of result.docs) {
      lines.push(renderDocLine(doc));

      if (options?.sections) {
        for (const section of doc.sections) {
          lines.push(`${section.depth === 3 ? '    ' : '  '}- \`${section.id}\` ${section.title}`);
        }
      }
    }

    lines.push('', readFooter(docs));
  }

  return lines.join('\n');
}

/**
 * Renders docs search hits as a markdown list.
 *
 * @param result - The docs API search result.
 * @param options - The query, plus the CLI and command names.
 * @returns The markdown.
 * @__NO_SIDE_EFFECTS__
 */
export function renderDocsSearchMarkdown(result: DocsSearchResult, options: RenderDocsSearchMarkdownOptions): string {
  const docs = docsCommandPrefix(options);
  const { query } = options;
  const lines: string[] = [];

  if (result.results.length === 0) {
    lines.push(`No docs match "${query}". List the docs you can read: \`${docs} list\`.`);
  } else {
    lines.push(`# Docs matching "${query}" (${result.results.length} of ${result.total})`, '');

    if (result.partial) {
      lines.push('_No doc matched every word; these match some of them._', '');
    }

    for (const hit of result.results) {
      lines.push(renderSearchHitLine(hit));
    }

    lines.push('');

    if (result.total > result.results.length) {
      lines.push(`Showing ${result.results.length} of ${result.total}; raise \`--limit\` (max ${MAX_DOCS_SEARCH_LIMIT}) for more.`);
    }

    lines.push(readFooter(docs));
  }

  return lines.join('\n');
}

// MARK: Internal
function docsCommandPrefix(options: Maybe<DocsApiRenderOptions>): string {
  return `${options?.cliName ?? '<cli>'} ${options?.commandName ?? DEFAULT_DOCS_API_COMMAND_NAME}`;
}

function readFooter(docs: string): string {
  return `Read one: \`${docs} read <id> [section]\`. Search: \`${docs} search <words..>\`.`;
}

function renderDocLine(doc: Pick<DocsListEntry, 'id' | 'title' | 'description' | 'tags'>): string {
  const description = doc.description ? ` ${doc.description}` : '';
  const tags = doc.tags?.length ? ` _(tags: ${doc.tags.join(', ')})_` : '';
  return `- \`${doc.id}\` — ${withPeriod(doc.title)}${description}${tags}`;
}

function renderSearchHitLine(hit: DocsSearchResultEntry): string {
  return hit.section ? `- \`${hit.id}\` § \`${hit.section.id}\` — ${hit.section.title}` : renderDocLine(hit);
}

function withPeriod(title: string): string {
  return /[.!?]$/.test(title) ? title : `${title}.`;
}
