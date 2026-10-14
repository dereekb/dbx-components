import { createHash } from 'node:crypto';
import type { Maybe } from '@dereekb/util';
import { parseDocsFrontmatter, readDocsFrontmatterList, type DocsFrontmatterValue } from './docs-frontmatter';
import { extractDocsSections, extractDocsTitle, type DocsSection } from './docs-sections';

/**
 * Bumped when the manifest shape changes. Mirrored by `DOCS_MANIFEST_VERSION` in `@dereekb/firebase-server`.
 */
export const DOCS_MANIFEST_VERSION = 1;

/**
 * Reserved audience: any authenticated caller may read the doc. Never needs listing in `--audiences`.
 */
export const DOCS_MANIFEST_AUDIENCE_ANY = 'any';

/**
 * The frontmatter keys a doc may set. Any other key is reported as a warning.
 */
export const DOCS_FRONTMATTER_KEYS: readonly string[] = ['title', 'description', 'tags', 'audience'];

/**
 * One section of a {@link DocsManifestEntry}.
 */
export type DocsManifestSection = DocsSection;

/**
 * One doc in the manifest.
 */
export interface DocsManifestEntry {
  /**
   * The doc path relative to the docs folder, without `.md` (e.g. `guides/setup`). Clients read docs by this id only.
   */
  readonly id: string;
  /**
   * POSIX path relative to the docs folder (e.g. `guides/setup.md`).
   */
  readonly path: string;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  /**
   * Audiences allowed to read the doc. The caller needs at least one of them.
   */
  readonly audience: readonly string[];
  readonly sections: readonly DocsManifestSection[];
  /**
   * Hex sha256 of the file bytes. The server refuses a doc whose bytes no longer match.
   */
  readonly sha256: string;
  /**
   * File size in bytes.
   */
  readonly size: number;
}

/**
 * The `docs.manifest.json` written by `dbx-cli-generate-docs-manifest` and read by the `@dereekb/firebase-server` docs API.
 */
export interface DocsManifest {
  readonly version: number;
  readonly generatedAt: string;
  readonly app: string;
  /**
   * The audience allow-list the manifest was generated with (`any` is implied).
   */
  readonly audiences: readonly string[];
  readonly docs: readonly DocsManifestEntry[];
}

/**
 * Severity of a {@link DocsManifestFinding}. Errors fail generation.
 */
export type DocsManifestFindingSeverity = 'error' | 'warning';

/**
 * Finding codes reported while building a docs manifest.
 */
export type DocsManifestFindingCode = 'DOCS_AUDIENCE_MISSING' | 'DOCS_AUDIENCE_UNKNOWN' | 'DOCS_NOT_MARKDOWN' | 'DOCS_DOTFILE' | 'DOCS_SYMLINK_ESCAPE' | 'DOCS_FRONTMATTER_UNKNOWN_KEY' | 'DOCS_FRONTMATTER_INVALID' | 'DOCS_FRONTMATTER_INVALID_VALUE' | 'DOCS_TITLE_MISSING' | 'DOCS_EMPTY';

/**
 * One problem found while building a docs manifest.
 */
export interface DocsManifestFinding {
  readonly code: DocsManifestFindingCode;
  readonly severity: DocsManifestFindingSeverity;
  /**
   * The doc path relative to the docs folder, when the finding is about one file.
   */
  readonly path?: string;
  readonly message: string;
}

/**
 * One markdown file handed to {@link buildDocsManifest}.
 */
export interface DocsManifestSourceFile {
  /**
   * POSIX path relative to the docs folder.
   */
  readonly path: string;
  readonly content: Buffer;
}

/**
 * Input for {@link buildDocsManifest}.
 */
export interface BuildDocsManifestInput {
  readonly app: string;
  /**
   * The audience allow-list. A doc naming any other audience (besides `any`) is an error.
   */
  readonly audiences: readonly string[];
  /**
   * Audience applied to docs without an `audience` frontmatter key. With none, such a doc is an error.
   */
  readonly defaultAudience?: Maybe<readonly string[]>;
  readonly files: readonly DocsManifestSourceFile[];
  /**
   * Defaults to now.
   */
  readonly generatedAt?: Maybe<Date>;
}

/**
 * Result of {@link buildDocsManifest}. A file with an error finding is left out of `manifest.docs`.
 */
export interface BuildDocsManifestResult {
  readonly manifest: DocsManifest;
  readonly findings: readonly DocsManifestFinding[];
}

/**
 * Builds a docs manifest from markdown files already read from the docs folder.
 *
 * Each doc's audience comes from its `audience` frontmatter (or the default audience) and must be in the allow-list or
 * be `any`. Sections are the H2/H3 headings; the title is the `title` frontmatter, then the first H1, then the file name.
 *
 * @param input - The app name, audience rules and source files.
 * @returns The manifest (docs sorted by id) and every finding.
 */
export function buildDocsManifest(input: BuildDocsManifestInput): BuildDocsManifestResult {
  const { app, files, defaultAudience } = input;
  const audiences = Array.from(new Set(input.audiences.filter((x) => x !== DOCS_MANIFEST_AUDIENCE_ANY)));
  const allowedAudiences = new Set([...audiences, DOCS_MANIFEST_AUDIENCE_ANY]);
  const findings: DocsManifestFinding[] = [];
  const docs: DocsManifestEntry[] = [];

  for (const file of files) {
    const { path } = file;
    const parsed = parseDocsFrontmatter(file.content.toString('utf8'));
    let hasError = false;

    for (const problem of parsed.problems) {
      findings.push({ code: 'DOCS_FRONTMATTER_INVALID', severity: 'warning', path, message: `line ${problem.line}: ${problem.message}` });
    }

    for (const key of Object.keys(parsed.values)) {
      if (!DOCS_FRONTMATTER_KEYS.includes(key)) {
        findings.push({ code: 'DOCS_FRONTMATTER_UNKNOWN_KEY', severity: 'warning', path, message: `Unknown frontmatter key "${key}" (known: ${DOCS_FRONTMATTER_KEYS.join(', ')}).` });
      }
    }

    const audience = readDocsFrontmatterList(parsed.values['audience']) ?? defaultAudience ?? [];

    if (audience.length === 0) {
      hasError = true;
      findings.push({ code: 'DOCS_AUDIENCE_MISSING', severity: 'error', path, message: 'No audience. Set "audience: [<audience>]" in the frontmatter or pass --default-audience.' });
    }

    const unknownAudiences = audience.filter((x) => !allowedAudiences.has(x));

    if (unknownAudiences.length > 0) {
      hasError = true;
      const unknownList = unknownAudiences.map((x) => JSON.stringify(x)).join(', ');
      findings.push({ code: 'DOCS_AUDIENCE_UNKNOWN', severity: 'error', path, message: `Unknown audience(s) ${unknownList}. Allowed: ${Array.from(allowedAudiences).join(', ')}.` });
    }

    const title = readDocsScalar({ path, key: 'title', value: parsed.values['title'], findings }) ?? extractDocsTitle(parsed.body);
    const description = readDocsScalar({ path, key: 'description', value: parsed.values['description'], findings });
    const tags = readDocsFrontmatterList(parsed.values['tags']);

    if (title == null) {
      findings.push({ code: 'DOCS_TITLE_MISSING', severity: 'warning', path, message: 'No "title" frontmatter and no H1 heading; using the file name.' });
    }

    if (!hasError) {
      docs.push({
        id: path.replace(/\.md$/i, ''),
        path,
        title: title ?? (path.split('/').pop() ?? path).replace(/\.md$/i, ''),
        ...(description == null ? {} : { description }),
        ...(tags == null || tags.length === 0 ? {} : { tags }),
        audience: Array.from(new Set(audience)),
        sections: extractDocsSections(parsed.body),
        sha256: createHash('sha256').update(file.content).digest('hex'),
        size: file.content.byteLength
      });
    }
  }

  docs.sort((a, b) => a.id.localeCompare(b.id));

  const manifest: DocsManifest = { version: DOCS_MANIFEST_VERSION, generatedAt: (input.generatedAt ?? new Date()).toISOString(), app, audiences, docs };
  return { manifest, findings };
}

interface ReadDocsScalarInput {
  readonly path: string;
  readonly key: string;
  readonly value: DocsFrontmatterValue | undefined;
  readonly findings: DocsManifestFinding[];
}

function readDocsScalar(input: ReadDocsScalarInput): Maybe<string> {
  const { path, key, value, findings } = input;
  let result: Maybe<string>;

  if (typeof value === 'string') {
    result = value.length > 0 ? value : undefined;
  } else if (value != null) {
    findings.push({ code: 'DOCS_FRONTMATTER_INVALID_VALUE', severity: 'warning', path, message: `Frontmatter "${key}" must be a single value, not a list; ignored.` });
  }

  return result;
}
