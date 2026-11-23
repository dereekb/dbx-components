/**
 * The docs manifest's frontmatter reader: `@dereekb/util` `parseMarkdownFrontmatter` with every value kept a string.
 *
 * Doc frontmatter needs only `key: scalar`, inline lists (`key: [a, b]`) and block lists (`key:` followed by `- item`
 * lines), so the generator carries no `yaml` dependency. Anything else is reported as a finding instead of being guessed
 * at.
 */

import { parseMarkdownFrontmatter } from '@dereekb/util';

/**
 * One parsed frontmatter value: a scalar string or a list of strings.
 */
export type DocsFrontmatterValue = string | readonly string[];

/**
 * A line the parser could not read, reported with its 1-based line number in the source file.
 */
export interface DocsFrontmatterProblem {
  readonly line: number;
  readonly message: string;
}

/**
 * Result of {@link parseDocsFrontmatter}.
 */
export interface DocsFrontmatterParseResult {
  /**
   * True when the content opened with a `---` frontmatter block.
   */
  readonly hasFrontmatter: boolean;
  readonly values: Readonly<Record<string, DocsFrontmatterValue>>;
  /**
   * The markdown after the frontmatter block (the whole content when there is none).
   */
  readonly body: string;
  readonly problems: readonly DocsFrontmatterProblem[];
}

/**
 * Parses the leading `---` frontmatter block of a markdown document with `@dereekb/util` `parseMarkdownFrontmatter`
 * (`typedScalars: false`, so every value stays a string).
 *
 * A bare `key:` with nothing under it reads as `[]`. A key holding nested `key: value` rows is left out and reported.
 *
 * @param content - The full markdown file content.
 * @returns The parsed values, the remaining body, and any unreadable lines.
 * @example
 * ```ts
 * parseDocsFrontmatter('---\ntitle: Setup\naudience: [admin]\n---\n# Setup');
 * // values: { title: 'Setup', audience: ['admin'] }
 * ```
 */
export function parseDocsFrontmatter(content: string): DocsFrontmatterParseResult {
  const parsed = parseMarkdownFrontmatter(content, { typedScalars: false });
  const values: Record<string, DocsFrontmatterValue> = {};
  const problems: DocsFrontmatterProblem[] = [...parsed.problems];

  for (const [key, value] of Object.entries(parsed.values)) {
    if (value == null) {
      values[key] = [];
    } else if (Array.isArray(value)) {
      values[key] = value.map(String);
    } else if (typeof value === 'object') {
      problems.push({ line: parsed.lines.get(key) ?? 1, message: `"${key}" holds nested keys. Use "key: value", "key: [a, b]" or a "- item" list.` });
    } else {
      values[key] = String(value);
    }
  }

  problems.sort((a, b) => a.line - b.line);
  return { hasFrontmatter: parsed.hasFrontmatter, values, body: parsed.body, problems };
}

/**
 * Reads a frontmatter value as a list. A scalar becomes a one-item list; comma-separated scalars are split.
 *
 * @param value - The parsed frontmatter value.
 * @returns The non-empty trimmed items, or `undefined` when the value is unset.
 */
export function readDocsFrontmatterList(value: DocsFrontmatterValue | undefined): string[] | undefined {
  let result: string[] | undefined;

  if (typeof value === 'string') {
    result = splitDocsFrontmatterList(value);
  } else if (value != null) {
    result = value.map((x) => x.trim()).filter((x) => x.length > 0);
  }

  return result;
}

function splitDocsFrontmatterList(text: string): string[] {
  return text
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}
