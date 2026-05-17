/**
 * Reference scanner for `@dbxModelFirebaseIndex`-tagged factories.
 *
 * Given a list of extracted entries and a glob of consumer `.ts` files in
 * a `-firebase` component, counts the external references to each factory
 * by name. Used by `dbx_model_firebase_index_list_app` to surface the
 * `referenceCount` + `referencedBy` columns, and by
 * `dbx_model_firebase_index_validate_app` to emit
 * `MODEL_FIREBASE_INDEX_UNUSED_FACTORY` when a non-skip / non-manual
 * factory has zero external references.
 *
 * Implementation note: deliberately text-based rather than AST-based. The
 * extractor's in-memory ts-morph project only contains `*.query.ts`
 * files, so AST `findReferencesAsNodes()` would miss the actions /
 * services / API callers that actually use these factories. Loading every
 * consumer into ts-morph would be slow and would force the consumer of
 * this module to expand the scan globs. A word-boundary text scan against
 * the factory names is precise enough — collisions would require an
 * unrelated identifier with the same exact name AND export-style
 * `.query.ts` factory naming (e.g. `*Query`), which the existing factory-
 * naming convention already rules out in practice.
 */

import { relative, resolve as resolvePath } from 'node:path';
import { defaultGlobber, defaultReadFile, type ScanGlobber, type ScanReadFile } from './scan-io.js';
import type { ExtractedModelFirebaseIndexEntry } from './model-firebase-index-extract.js';

// MARK: Public types
/**
 * One usage of a factory found in a consumer file.
 */
export interface FactoryReferenceSite {
  readonly file: string;
  readonly line: number;
}

/**
 * Per-factory reference report. Keyed by the entry's `slug` in the
 * scanner's return value.
 */
export interface FactoryReferenceCount {
  readonly count: number;
  readonly referencedBy: readonly FactoryReferenceSite[];
}

/**
 * Input to {@link scanFactoryReferences}.
 */
export interface ScanFactoryReferencesInput {
  readonly projectRoot: string;
  readonly entries: readonly Pick<ExtractedModelFirebaseIndexEntry, 'slug' | 'name' | 'filePath'>[];
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly readFile?: ScanReadFile;
  readonly globber?: ScanGlobber;
}

// MARK: Defaults
const DEFAULT_INCLUDE: readonly string[] = ['src/**/*.ts'];
const DEFAULT_EXCLUDE: readonly string[] = ['**/*.spec.ts', '**/*.d.ts'];

// MARK: Entry point
/**
 * Counts external references to each entry's exported factory by name.
 *
 * Walks every `.ts` file under {@link projectRoot} (default
 * `src/**\/*.ts`, excluding specs + `.d.ts`), reads it once, and scans
 * for word-boundary occurrences of each factory name. References inside
 * the factory's own declaration file are excluded — only callers count.
 *
 * @param input - Project root, the entries to count, optional glob + IO overrides for tests.
 * @returns Map keyed by entry slug → reference count + locations.
 */
export async function scanFactoryReferences(input: ScanFactoryReferencesInput): Promise<ReadonlyMap<string, FactoryReferenceCount>> {
  const { projectRoot, entries, include = DEFAULT_INCLUDE, exclude = DEFAULT_EXCLUDE, readFile = defaultReadFile, globber = defaultGlobber } = input;
  const result = new Map<string, FactoryReferenceCount>();

  for (const entry of entries) {
    result.set(entry.slug, { count: 0, referencedBy: [] });
  }
  if (entries.length === 0) {
    return result;
  }

  const namesBySlug = buildNameLookup(entries);
  const declFilePathsBySlug = buildDeclFilePathLookup(entries);
  const declFilePaths = new Set<string>(declFilePathsBySlug.values());
  const filePaths = await globber({ projectRoot, include, exclude: [...exclude] });
  const combinedPattern = buildCombinedRegex(Array.from(namesBySlug.values()));

  if (combinedPattern === undefined) {
    return result;
  }

  const sitesBySlug = new Map<string, FactoryReferenceSite[]>();
  for (const entry of entries) {
    sitesBySlug.set(entry.slug, []);
  }

  for (const relPath of filePaths) {
    const absolutePath = resolvePath(projectRoot, relPath);
    if (declFilePaths.has(absolutePath)) {
      continue;
    }
    await scanOneFile({ absolutePath, projectRoot, readFile, combinedPattern, namesBySlug, sitesBySlug });
  }

  for (const [slug, sites] of sitesBySlug) {
    result.set(slug, { count: sites.length, referencedBy: sites });
  }
  return result;
}

// MARK: One-file scan
interface ScanOneFileInput {
  readonly absolutePath: string;
  readonly projectRoot: string;
  readonly readFile: ScanReadFile;
  readonly combinedPattern: RegExp;
  readonly namesBySlug: ReadonlyMap<string, string>;
  readonly sitesBySlug: Map<string, FactoryReferenceSite[]>;
}

async function scanOneFile(input: ScanOneFileInput): Promise<void> {
  const { absolutePath, projectRoot, readFile, combinedPattern, namesBySlug, sitesBySlug } = input;
  let contents: string;
  try {
    contents = await readFile(absolutePath);
  } catch {
    return;
  }
  const slugByName = invertNameLookup(namesBySlug);
  const lineOffsets = computeLineOffsets(contents);
  combinedPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  const subpath = toSubpath(absolutePath, projectRoot);
  while ((match = combinedPattern.exec(contents)) !== null) {
    const captured = match[0];
    const slug = slugByName.get(captured);
    if (slug === undefined) {
      continue;
    }
    const line = lineOffsets.findLineFor(match.index);
    const sites = sitesBySlug.get(slug);
    sites?.push({ file: subpath, line });
  }
}

// MARK: Helpers
function buildNameLookup(entries: readonly Pick<ExtractedModelFirebaseIndexEntry, 'slug' | 'name'>[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (entry.name.length > 0) {
      map.set(entry.slug, entry.name);
    }
  }
  return map;
}

function buildDeclFilePathLookup(entries: readonly Pick<ExtractedModelFirebaseIndexEntry, 'slug' | 'filePath'>[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    map.set(entry.slug, entry.filePath);
  }
  return map;
}

function invertNameLookup(namesBySlug: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const [slug, name] of namesBySlug) {
    out.set(name, slug);
  }
  return out;
}

function buildCombinedRegex(names: readonly string[]): RegExp | undefined {
  const escaped = names.filter((n) => n.length > 0).map(escapeRegex);
  let result: RegExp | undefined;
  if (escaped.length > 0) {
    result = new RegExp(`(?<![A-Za-z0-9_$])(?:${escaped.join('|')})(?![A-Za-z0-9_$])`, 'g');
  }
  return result;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface LineOffsetIndex {
  readonly findLineFor: (offset: number) => number;
}

function computeLineOffsets(contents: string): LineOffsetIndex {
  const offsets: number[] = [0];
  for (let i = 0; i < contents.length; i += 1) {
    if (contents.charCodeAt(i) === 10) {
      offsets.push(i + 1);
    }
  }
  return {
    findLineFor: (offset) => {
      let lo = 0;
      let hi = offsets.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >>> 1;
        if (offsets[mid] <= offset) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      return lo + 1;
    }
  };
}

function toSubpath(absolutePath: string, projectRoot: string): string {
  const normalised = absolutePath.replaceAll('\\', '/');
  const rootNormalised = projectRoot.replaceAll('\\', '/');
  let result: string;
  if (normalised.startsWith(rootNormalised)) {
    result = normalised.slice(rootNormalised.length).replace(/^\/+/, '');
  } else {
    result = relative(projectRoot, absolutePath).replaceAll('\\', '/');
  }
  return result;
}
