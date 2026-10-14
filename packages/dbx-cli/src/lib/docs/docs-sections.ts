/**
 * Markdown heading extraction for the docs manifest. Sections are the H2/H3 headings; headings inside
 * fenced code blocks are skipped.
 */

/**
 * The heading depths that become manifest sections.
 */
export type DocsSectionDepth = 2 | 3;

/**
 * One section heading of a doc.
 */
export interface DocsSection {
  /**
   * The slugged heading, unique within its doc (repeats get a `-2`, `-3`, … suffix).
   */
  readonly id: string;
  readonly title: string;
  readonly depth: DocsSectionDepth;
}

/**
 * One ATX heading found by {@link scanDocsMarkdownHeadings}.
 */
export interface DocsMarkdownHeading {
  readonly depth: number;
  readonly title: string;
  /**
   * 0-based line index within the scanned text.
   */
  readonly lineIndex: number;
}

const HEADING_REGEX = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE_REGEX = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Lists the ATX headings of a markdown body, skipping fenced code blocks.
 *
 * @param body - The markdown body (frontmatter already removed).
 * @returns Every heading in document order.
 */
export function scanDocsMarkdownHeadings(body: string): DocsMarkdownHeading[] {
  const headings: DocsMarkdownHeading[] = [];
  const lines = body.split(/\r?\n/);
  let openFence: string | undefined;

  lines.forEach((line, lineIndex) => {
    const fence = FENCE_REGEX.exec(line);

    if (fence != null) {
      const marker = fence[1];

      if (openFence == null) {
        openFence = marker;
      } else if (marker[0] === openFence[0] && marker.length >= openFence.length) {
        openFence = undefined;
      }
    } else if (openFence == null) {
      const heading = HEADING_REGEX.exec(line);

      if (heading != null && heading[2].length > 0) {
        headings.push({ depth: heading[1].length, title: heading[2], lineIndex });
      }
    }
  });

  return headings;
}

/**
 * Slugs a heading title: lowercase, inline markdown removed, runs of non-alphanumerics become `-`.
 *
 * @param title - The heading text.
 * @returns The slug, or `section` when nothing is left.
 */
export function slugifyDocsHeading(title: string): string {
  const slug = title
    .toLowerCase()
    .replaceAll(/[`*_~]/g, '')
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'section';
}

/**
 * Extracts a doc's H2/H3 sections with unique slugged ids.
 *
 * @param body - The markdown body (frontmatter already removed).
 * @returns The sections in document order.
 */
export function extractDocsSections(body: string): DocsSection[] {
  const used = new Map<string, number>();
  const sections: DocsSection[] = [];

  for (const heading of scanDocsMarkdownHeadings(body)) {
    if (heading.depth === 2 || heading.depth === 3) {
      const base = slugifyDocsHeading(heading.title);
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      sections.push({ id: count === 1 ? base : `${base}-${count}`, title: heading.title, depth: heading.depth });
    }
  }

  return sections;
}

/**
 * Reads a doc's first H1 heading.
 *
 * @param body - The markdown body (frontmatter already removed).
 * @returns The H1 text, or `undefined` when the doc has none.
 */
export function extractDocsTitle(body: string): string | undefined {
  return scanDocsMarkdownHeadings(body).find((x) => x.depth === 1)?.title;
}
