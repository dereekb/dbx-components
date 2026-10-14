import { type Maybe } from '@dereekb/util';
import { type DocsAudience } from './docs.api.config';

// MARK: Manifest
/**
 * The docs manifest version this runtime reads. Mirrors `DOCS_MANIFEST_VERSION` in `@dereekb/dbx-cli`, which writes
 * the manifest; a manifest with any other version is ignored.
 */
export const DOCS_MANIFEST_VERSION = 1;

/**
 * One section (H2/H3 heading) of a doc.
 */
export interface DocsManifestSection {
  readonly id: string;
  readonly title: string;
  readonly depth: 2 | 3;
}

/**
 * One doc in the manifest.
 */
export interface DocsManifestEntry {
  /**
   * The doc path relative to the docs folder, without `.md`. Clients read docs by this id only.
   */
  readonly id: string;
  /**
   * POSIX path relative to the docs folder.
   */
  readonly path: string;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly audience: readonly DocsAudience[];
  readonly sections: readonly DocsManifestSection[];
  readonly sha256: string;
  readonly size: number;
}

/**
 * The `docs.manifest.json` written by `dbx-cli-generate-docs-manifest`.
 */
export interface DocsManifest {
  readonly version: number;
  readonly generatedAt: string;
  readonly app: string;
  readonly audiences: readonly DocsAudience[];
  readonly docs: readonly DocsManifestEntry[];
}

/**
 * Reads a parsed manifest JSON value, returning `undefined` when it is not a docs manifest of {@link DOCS_MANIFEST_VERSION}.
 *
 * @param value - The parsed JSON.
 * @returns The manifest, or `undefined`.
 */
export function readDocsManifestJson(value: unknown): Maybe<DocsManifest> {
  const candidate = value as Maybe<Partial<DocsManifest>>;
  const isManifest = candidate != null && typeof candidate === 'object' && candidate.version === DOCS_MANIFEST_VERSION && Array.isArray(candidate.docs) && Array.isArray(candidate.audiences);
  return isManifest ? (candidate as DocsManifest) : undefined;
}

// MARK: Markdown
/**
 * One section body split from a doc by {@link splitDocsMarkdownSections}.
 */
export interface DocsMarkdownSectionText {
  readonly section: DocsManifestSection;
  /**
   * The section from its heading up to the next heading of the same or a higher level (H3s stay inside their H2).
   */
  readonly content: string;
  /**
   * The text directly under the heading, up to the next heading of any level. Used for search.
   */
  readonly ownText: string;
}

/**
 * Result of {@link splitDocsMarkdownSections}.
 */
export interface DocsMarkdownSplit {
  /**
   * The doc with its frontmatter removed.
   */
  readonly body: string;
  /**
   * The text before the first section heading.
   */
  readonly intro: string;
  readonly sections: readonly DocsMarkdownSectionText[];
}

const DOCS_HEADING_REGEX = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const DOCS_FENCE_REGEX = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Splits a doc into its manifest sections.
 *
 * Headings are found the way the generator finds them (ATX headings outside fenced code). The H2/H3 headings are
 * matched to the manifest's sections in document order, which holds whenever the content hash matches the manifest.
 *
 * @param content - The raw doc content, including frontmatter.
 * @param sections - The doc's manifest sections.
 * @returns The body, intro and section texts.
 */
export function splitDocsMarkdownSections(content: string, sections: readonly DocsManifestSection[]): DocsMarkdownSplit {
  const lines = content.split(/\r?\n/);
  let start = 0;

  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    start = close === -1 ? 0 : close + 1;
  }

  const bodyLines = lines.slice(start);
  const headings: { readonly depth: number; readonly lineIndex: number }[] = [];
  let openFence: Maybe<string>;

  bodyLines.forEach((line, lineIndex) => {
    const fence = DOCS_FENCE_REGEX.exec(line);

    if (fence != null) {
      const marker = fence[1];

      if (openFence == null) {
        openFence = marker;
      } else if (marker[0] === openFence[0] && marker.length >= openFence.length) {
        openFence = undefined;
      }
    } else if (openFence == null) {
      const heading = DOCS_HEADING_REGEX.exec(line);

      if (heading != null && heading[2].length > 0) {
        headings.push({ depth: heading[1].length, lineIndex });
      }
    }
  });

  const sectionHeadings = headings.filter((x) => x.depth === 2 || x.depth === 3);
  const result: DocsMarkdownSectionText[] = [];

  sections.forEach((section, i) => {
    const heading = sectionHeadings[i];

    if (heading != null) {
      const endOfContent = headings.find((x) => x.lineIndex > heading.lineIndex && x.depth <= heading.depth)?.lineIndex ?? bodyLines.length;
      const endOfOwnText = headings.find((x) => x.lineIndex > heading.lineIndex)?.lineIndex ?? bodyLines.length;
      result.push({
        section,
        content: bodyLines.slice(heading.lineIndex, endOfContent).join('\n').trim(),
        ownText: bodyLines
          .slice(heading.lineIndex + 1, endOfOwnText)
          .join('\n')
          .trim()
      });
    }
  });

  const firstSectionLine = sectionHeadings[0]?.lineIndex ?? bodyLines.length;
  return { body: bodyLines.join('\n').trim(), intro: bodyLines.slice(0, firstSectionLine).join('\n').trim(), sections: result };
}
