/**
 * Reference scanner for `@dbxModelFirebaseIndex`-tagged factories.
 *
 * Given a list of extracted entries and a glob of consumer `.ts` files,
 * counts the external references to each factory by name. Used by
 * `dbx_model_firebase_index_list_app` to surface the `referenceCount` +
 * `referencedBy` columns, and by `dbx_model_firebase_index_validate_app`
 * to emit `MODEL_FIREBASE_INDEX_UNUSED_FACTORY` when a non-skip /
 * non-manual factory has zero external references.
 *
 * Scope: the consumers (`*_list_app`, `*_validate_app`) point the scan at
 * the workspace root (`process.cwd()`) with workspace-wide globs covering
 * `apps/**`, `components/**`, and `packages/**` so callers in sibling
 * components, downstream apps, or shared packages are counted alongside
 * intra-component references. {@link WORKSPACE_FACTORY_SCAN_INCLUDE} and
 * {@link WORKSPACE_FACTORY_SCAN_EXCLUDE} are the canonical defaults.
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

import type { Maybe } from '@dereekb/util';
import { relative, resolve as resolvePath } from 'node:path';
import { defaultGlobber, defaultReadFile, type ScanGlobber, type ScanReadFile } from '../../scan-helpers/scan-io.js';
import type { ExtractedModelFirebaseIndexEntry } from '@dereekb/dbx-cli/firestore-indexes';

// MARK: Public types
/**
 * One usage of a factory found in a consumer file.
 */
export interface FactoryReferenceSite {
  readonly file: string;
  readonly line: number;
  /**
   * True when the consumer file is a `*.spec.ts` (test) file. Used by the
   * validator to enforce `@dbxModelFirebaseIndexSpecFilesOnly` semantics —
   * spec-only factories may only have spec callers, and a regular factory's
   * "unused" check still counts only non-spec callers.
   */
  readonly isSpec: boolean;
}

/**
 * Per-factory reference report. Keyed by the entry's `slug` in the
 * scanner's return value. `count` is the total site count;
 * `productionCount` / `specCount` partition it by whether the site lives
 * in a `*.spec.ts` file. `referencedBy` carries every site (each tagged
 * with `isSpec`) so consumers can render the full breakdown without
 * re-counting.
 */
export interface FactoryReferenceCount {
  readonly count: number;
  readonly productionCount: number;
  readonly specCount: number;
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

/**
 * Canonical include-glob set the tool layer hands to {@link scanFactoryReferences}
 * when the projectRoot is the workspace root. Covers every place a downstream
 * project may call a tagged factory: apps, sibling components, and shared
 * packages. Keep these aligned with the Nx workspace layout — the validator's
 * `MODEL_FIREBASE_INDEX_UNUSED_FACTORY` warning is only useful if it sees
 * every plausible call-site.
 */
export const WORKSPACE_FACTORY_SCAN_INCLUDE: readonly string[] = ['apps/**/*.ts', 'components/**/*.ts', 'packages/**/*.ts'];

/**
 * Canonical exclude-glob set paired with {@link WORKSPACE_FACTORY_SCAN_INCLUDE}.
 * Strips ambient typings, build outputs, and `node_modules` so the
 * workspace-wide scan stays fast. `*.spec.ts` files are intentionally KEPT
 * so the scanner can flag spec callers (`isSpec: true`) — the validator
 * uses that to enforce `@dbxModelFirebaseIndexSpecFilesOnly` and to treat
 * spec-only references as "not a production caller" for the unused-factory
 * warning.
 */
export const WORKSPACE_FACTORY_SCAN_EXCLUDE: readonly string[] = ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'];

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
    result.set(entry.slug, { count: 0, productionCount: 0, specCount: 0, referencedBy: [] });
  }

  if (entries.length > 0) {
    const namesBySlug = buildNameLookup(entries);
    const declFilePathsBySlug = buildDeclFilePathLookup(entries);
    const declFilePaths = new Set<string>(declFilePathsBySlug.values());
    const filePaths = await globber({ projectRoot, include, exclude: [...exclude] });
    const combinedPattern = buildCombinedRegex(Array.from(namesBySlug.values()));

    if (combinedPattern !== undefined) {
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
        let specCount = 0;
        for (const site of sites) {
          if (site.isSpec) {
            specCount += 1;
          }
        }
        result.set(slug, { count: sites.length, productionCount: sites.length - specCount, specCount, referencedBy: sites });
      }
    }
  }
  return result;
}

/**
 * Returns true when the supplied workspace-relative subpath looks like a
 * Vitest/Jest spec file. The scanner uses this to tag each
 * {@link FactoryReferenceSite} so the validator can enforce
 * `@dbxModelFirebaseIndexSpecFilesOnly` semantics.
 *
 * @param subpath - Workspace-relative file path (forward slashes)
 * @returns True when the file ends with `.spec.ts` or `.spec.tsx`
 */
function isSpecSubpath(subpath: string): boolean {
  return subpath.endsWith('.spec.ts') || subpath.endsWith('.spec.tsx');
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
  let match: Maybe<RegExpExecArray>;
  const subpath = toSubpath(absolutePath, projectRoot);
  const isSpec = isSpecSubpath(subpath);
  while ((match = combinedPattern.exec(contents)) !== null) {
    const captured = match[0];
    const slug = slugByName.get(captured);
    if (slug === undefined) {
      continue;
    }
    const line = lineOffsets.findLineFor(match.index);
    const sites = sitesBySlug.get(slug);
    sites?.push({ file: subpath, line, isSpec });
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
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

interface LineOffsetIndex {
  readonly findLineFor: (offset: number) => number;
}

function computeLineOffsets(contents: string): LineOffsetIndex {
  const offsets: number[] = [0];
  for (let i = 0; i < contents.length; i += 1) {
    if (contents.codePointAt(i) === 10) {
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
