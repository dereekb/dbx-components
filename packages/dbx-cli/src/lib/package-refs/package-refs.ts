import { extractDocsTitle } from '../docs/docs-sections';
import { parseDocsFrontmatter } from '../docs/docs-frontmatter';

/**
 * The `package.json` key a package declares its shipped dbx-claude refs under.
 */
export const DBX_CLAUDE_PACKAGE_JSON_KEY = 'dbxClaude';

/**
 * The folder, relative to the package root, that holds one sub-folder per shipped ref.
 */
export const PACKAGE_REFS_DIR = 'refs';

/**
 * The root doc of a shipped ref: `refs/<name>/REF.md`.
 */
export const PACKAGE_REF_ROOT_FILENAME = 'REF.md';

/**
 * The folder, inside a ref's folder, that holds its sub-docs: `refs/<name>/references/<doc>.md`.
 */
export const PACKAGE_REF_SUBDOC_DIR = 'references';

/**
 * The pattern every ref name and sub-doc key matches: lowercase letters, digits and dashes, starting with a letter or digit.
 */
export const PACKAGE_REF_NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/;

/**
 * The declaration keys a package may not set. A package can only suggest a ref: dbx-claude always delivers it as a
 * read hint, and a consuming project escalates through its own config.
 */
export const PACKAGE_REF_REJECTED_KEYS: readonly string[] = ['id', 'path', 'source', 'delivery', 'tone', 'reReadOnRefire', 'maxFires', 'maxDenies'];

/**
 * One trigger of a shipped ref. dbx-claude owns the trigger schema (its `DbxClaudeDeclaredReference` triggers:
 * `words`, `fuzzyWords`, `pathContains`, `suffixes`, `toolNames`, `capabilities`, `every`, …) and validates it; this
 * side only requires a non-empty object.
 */
export type DbxClaudePackageRefTrigger = Readonly<Record<string, unknown>>;

/**
 * One ref a package declares in `package.json` under `dbxClaude.refs`.
 */
export interface DbxClaudePackageRefDeclaration {
  /**
   * The ref name. Matches the folder `refs/<name>/` and the REF.md frontmatter `name`.
   */
  readonly name: string;
  /**
   * When dbx-claude suggests the ref. Same objects as a marker `references.project[].triggers` entry.
   */
  readonly triggers?: readonly DbxClaudePackageRefTrigger[];
}

/**
 * The `dbxClaude` value of a package's `package.json`.
 */
export interface DbxClaudePackageJsonConfig {
  readonly refs?: readonly DbxClaudePackageRefDeclaration[];
}

/**
 * One shipped ref, embedded in a CLI bundle through `?raw` imports of the same files the package publishes.
 */
export interface EmbeddedPackageRef {
  /**
   * The ref name, e.g. `msgraph-cli`.
   */
  readonly name: string;
  /**
   * The full REF.md content, frontmatter included.
   */
  readonly content: string;
  /**
   * Sub-docs keyed by file name without `.md`.
   */
  readonly docs?: Readonly<Record<string, string>>;
}

/**
 * Every ref a package ships, embedded in its CLI bundle.
 */
export interface EmbeddedPackageRefs {
  /**
   * The `name` of the package the refs ship with, e.g. `@dereekb/microsoft`.
   */
  readonly packageName: string;
  readonly refs: readonly EmbeddedPackageRef[];
}

/**
 * A topic {@link resolvePackageRefsDocsTopic} found.
 */
export interface PackageRefsDocsTopicFound {
  readonly found: true;
  /**
   * The canonical topic: `<ref>` or `<ref>/<doc>`.
   */
  readonly topic: string;
  readonly content: string;
}

/**
 * Why {@link resolvePackageRefsDocsTopic} found no single doc.
 */
export type PackageRefsDocsTopicMissReason = 'not-found' | 'ambiguous';

/**
 * A topic {@link resolvePackageRefsDocsTopic} could not resolve.
 */
export interface PackageRefsDocsTopicNotFound {
  readonly found: false;
  readonly reason: PackageRefsDocsTopicMissReason;
  /**
   * For `ambiguous`, the matching topics; for `not-found`, every topic.
   */
  readonly candidates: readonly string[];
}

/**
 * Result of {@link resolvePackageRefsDocsTopic}.
 */
export type PackageRefsDocsTopicResult = PackageRefsDocsTopicFound | PackageRefsDocsTopicNotFound;

/**
 * One row of the docs index built by {@link buildPackageRefsDocsIndex}.
 */
export interface PackageRefsDocsIndexEntry {
  /**
   * `<ref>` or `<ref>/<doc>`.
   */
  readonly topic: string;
  /**
   * The doc's first H1, or the topic when it has none.
   */
  readonly title: string;
  /**
   * A REF.md's frontmatter `description`. Sub-docs have none.
   */
  readonly description?: string;
}

/**
 * Lists every topic of the embedded refs: each ref, then each of its sub-docs as `<ref>/<doc>`.
 *
 * @param refs - The embedded refs.
 * @returns The topics, in declaration order with sub-docs sorted.
 */
export function packageRefsDocsTopics(refs: EmbeddedPackageRefs): string[] {
  return refs.refs.flatMap((ref) => [ref.name, ...packageRefDocKeys(ref).map((doc) => `${ref.name}/${doc}`)]);
}

/**
 * Resolves a `<cli> docs <topic>` argument to one embedded doc.
 *
 * Accepts `<ref>` (its REF.md), `<ref>/<doc>` (a sub-doc), or a bare `<doc>` when exactly one ref has that sub-doc.
 *
 * @param refs - The embedded refs.
 * @param topic - The requested topic.
 * @returns The doc, or why none was found with the candidate topics.
 * @example
 * ```ts
 * resolvePackageRefsDocsTopic(refs, 'msgraph-cli/mail');
 * // { found: true, topic: 'msgraph-cli/mail', content: '# Mail …' }
 * ```
 */
export function resolvePackageRefsDocsTopic(refs: EmbeddedPackageRefs, topic: string): PackageRefsDocsTopicResult {
  const trimmed = topic.trim();
  const slashIndex = trimmed.indexOf('/');
  let result: PackageRefsDocsTopicResult;

  if (slashIndex === -1) {
    const ref = refs.refs.find((x) => x.name === trimmed);

    if (ref == null) {
      const owners = refs.refs.filter((x) => x.docs?.[trimmed] != null);

      if (owners.length === 1) {
        result = { found: true, topic: `${owners[0].name}/${trimmed}`, content: owners[0].docs?.[trimmed] as string };
      } else if (owners.length > 1) {
        result = { found: false, reason: 'ambiguous', candidates: owners.map((x) => `${x.name}/${trimmed}`) };
      } else {
        result = { found: false, reason: 'not-found', candidates: packageRefsDocsTopics(refs) };
      }
    } else {
      result = { found: true, topic: ref.name, content: ref.content };
    }
  } else {
    const refName = trimmed.slice(0, slashIndex);
    const docKey = trimmed.slice(slashIndex + 1);
    const content = refs.refs.find((x) => x.name === refName)?.docs?.[docKey];
    result = content == null ? { found: false, reason: 'not-found', candidates: packageRefsDocsTopics(refs) } : { found: true, topic: `${refName}/${docKey}`, content };
  }

  return result;
}

/**
 * Builds the `<cli> docs` index: one entry per ref and per sub-doc.
 *
 * A ref's title comes from its REF.md's first H1 and its description from the frontmatter `description`. A sub-doc's
 * title comes from its first H1.
 *
 * @param refs - The embedded refs.
 * @returns The index entries, in {@link packageRefsDocsTopics} order.
 */
export function buildPackageRefsDocsIndex(refs: EmbeddedPackageRefs): PackageRefsDocsIndexEntry[] {
  return refs.refs.flatMap((ref) => {
    const { values, body } = parseDocsFrontmatter(ref.content);
    const description = typeof values['description'] === 'string' && values['description'].length > 0 ? values['description'] : undefined;
    const refEntry: PackageRefsDocsIndexEntry = { topic: ref.name, title: extractDocsTitle(body) ?? ref.name, ...(description == null ? {} : { description }) };
    const docEntries: PackageRefsDocsIndexEntry[] = packageRefDocKeys(ref).map((doc) => {
      const topic = `${ref.name}/${doc}`;
      return { topic, title: extractDocsTitle(parseDocsFrontmatter(ref.docs?.[doc] ?? '').body) ?? topic };
    });

    return [refEntry, ...docEntries];
  });
}

/**
 * Renders the docs index as markdown.
 *
 * @param refs - The embedded refs.
 * @param cliName - The CLI's binary name, used in the closing `Run:` line.
 * @returns The markdown index.
 */
export function renderPackageRefsDocsIndexMarkdown(refs: EmbeddedPackageRefs, cliName: string): string {
  const rows = buildPackageRefsDocsIndex(refs).map((entry) => {
    const description = entry.description == null ? '' : ` — ${entry.description}`;
    return `- \`${entry.topic}\`: ${entry.title}${description}`;
  });

  return [`# ${cliName} docs`, '', `Agent docs shipped with \`${refs.packageName}\`.`, '', ...rows, '', `Run: ${cliName} docs <topic>`, ''].join('\n');
}

function packageRefDocKeys(ref: EmbeddedPackageRef): string[] {
  return Object.keys(ref.docs ?? {}).sort((a, b) => a.localeCompare(b));
}
