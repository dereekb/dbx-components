/**
 * Inverse fixture→spec lookup for the `dbx_model_test_hotspots` tool.
 *
 * Given a model, finds the existing API integration `.spec.ts` "hotspots" that
 * reference the model's test fixture (or its parent fixtures), classified
 * crud-vs-scenario — and, when none exist, the canonical default spec files to
 * create. Composes the existing scanners ({@link inspectAppFixtures},
 * {@link discoverSpecFilesByGroup}, {@link extractSpecTreeFromText},
 * {@link searchSpecTree}) plus the `@dereekb/util` naming-convention helpers; the
 * only net-new logic is inverting "spec → fixtures it uses" into "fixture → specs
 * that use it" across the whole app.
 *
 * Why this exists: dbx-components API integration specs are grouped by model
 * **group** (`<group>.crud[.<sub>].spec.ts` / `<group>.scenario[.<sub>].spec.ts`),
 * not named per-model, so a filename search for a sub-model finds nothing even
 * though its behaviour is tested inside the parent group's specs.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { recommendBucketsForGroup, type SpecFileKind } from '@dereekb/util';
import { inspectAppFixtures } from '../fixture/inspect.js';
import type { FixtureEntry } from '../fixture/types.js';
import { discoverSpecFilesByGroup, type DiscoveredSpecCatalog } from './discover.js';
import { extractSpecTreeFromText } from './extract.js';
import { searchSpecTree } from './search.js';
import type { SpecSearchHit } from './types.js';

/**
 * The crud/scenario classification of a hotspot's spec file, collapsed from the
 * finer {@link SpecFileKind} (the `-subgroup` / `-misplaced` variants fold into
 * their base bucket; everything else is `other`).
 */
export type SpecBucket = 'crud' | 'scenario' | 'other';

/**
 * One existing spec file that references the target model's fixture or a parent
 * fixture, with the per-reference counts and the matched fixture nodes.
 */
export interface ModelTestHotspot {
  readonly fileRel: string;
  readonly bucket: SpecBucket;
  /**
   * Fixture-node matches whose model is the target itself.
   */
  readonly directRefs: number;
  /**
   * Fixture-node matches whose model is a parent fixture the target depends on.
   */
  readonly parentRefs: number;
  /**
   * The matched fixture nodes (direct then parent), each with its describe path,
   * inherited fixture chain, and 1-based line range.
   */
  readonly hits: readonly SpecSearchHit[];
}

/**
 * Result of {@link findModelTestHotspots}: the resolved fixture context plus the
 * ranked hotspots, or — when none reference the model — the canonical default
 * spec files to create.
 */
export interface ModelTestHotspotsResult {
  readonly model: string;
  readonly apiRel: string;
  /**
   * `true` when the model has a `<prefix><Model>TestContext` triplet in
   * `src/test/fixture.ts`; `false` ⇒ parent inference is unavailable and the
   * scan falls back to matching the bare model name in specs.
   */
  readonly fixtureFound: boolean;
  /**
   * Transitive parent-fixture models the target depends on (nearest first).
   */
  readonly parentModels: readonly string[];
  /**
   * The model group the hotspots / suggestions key off.
   */
  readonly group: string;
  /**
   * `true` when {@link group} matched an existing `function/<group>/` folder;
   * `false` ⇒ it was inferred from the model/parent name.
   */
  readonly groupMatchedExisting: boolean;
  /**
   * Existing spec files referencing the fixture, ranked direct-refs-first.
   */
  readonly hotspots: readonly ModelTestHotspot[];
  /**
   * Canonical default spec files to create — populated only when
   * {@link hotspots} is empty.
   */
  readonly suggestedFiles: readonly string[];
}

/**
 * Inputs to {@link findModelTestHotspots}.
 */
export interface FindModelTestHotspotsConfig {
  readonly apiAbs: string;
  readonly apiRel: string;
  readonly model: string;
}

/**
 * Finds the existing spec hotspots that reference a model's fixture (or its
 * parents), or the default files to create when there are none.
 *
 * @param config - The API-app paths + target model name.
 * @returns The resolved hotspots result.
 */
export async function findModelTestHotspots(config: FindModelTestHotspotsConfig): Promise<ModelTestHotspotsResult> {
  const { apiAbs, apiRel, model } = config;

  const fixtures = await inspectAppFixturesSafe(apiAbs, apiRel);
  const entries = fixtures?.entries ?? [];
  const prefix = fixtures?.prefix;
  const lowerPrefix = prefix === undefined ? '' : prefix.charAt(0).toLowerCase() + prefix.slice(1);
  const knownFixtureNames = entries.length > 0 ? entries.map((entry) => `${lowerPrefix}${entry.model}Context`) : undefined;

  const targetEntry = entries.find((entry) => entry.model.toLowerCase() === model.toLowerCase());
  const fixtureFound = targetEntry !== undefined;
  const parentModels = targetEntry === undefined ? [] : resolveParentModels(targetEntry, entries);

  const catalog = await discoverSpecFilesByGroup({ apiAbs, apiRel });
  const hotspots = await collectHotspots({ catalog, apiAbs, model, parentModels, prefix, knownFixtureNames });
  hotspots.sort(compareHotspots);

  const group = resolveGroup({ model, parentModels, catalog });
  const groupMatchedExisting = catalog.groups.some((g) => g.group === group);
  const suggestedFiles = hotspots.length > 0 ? [] : recommendBucketsForGroup({ apiDir: apiRel, group }).map((rec) => rec.canonicalPath);

  return { model, apiRel, fixtureFound, parentModels, group, groupMatchedExisting, hotspots, suggestedFiles };
}

/**
 * Reads the app fixtures, returning `undefined` when `src/test/fixture.ts` is
 * absent (a model can still be matched in specs by import-derived prefix).
 *
 * @param apiAbs - Absolute API-app path.
 * @param apiRel - Caller-relative API-app path.
 * @returns The extraction, or `undefined` when the fixture file can't be read.
 */
async function inspectAppFixturesSafe(apiAbs: string, apiRel: string): Promise<Awaited<ReturnType<typeof inspectAppFixtures>> | undefined> {
  let result: Awaited<ReturnType<typeof inspectAppFixtures>> | undefined;
  try {
    result = await inspectAppFixtures(apiAbs, apiRel);
  } catch {
    result = undefined;
  }
  return result;
}

/**
 * Walks the fixture dependency graph from `entry`, returning the transitive
 * parent-fixture models (nearest first, deduped, the target itself excluded).
 *
 * @param entry - The target model's fixture entry.
 * @param entries - All fixture entries in the app.
 * @returns The transitive parent models.
 */
function resolveParentModels(entry: FixtureEntry, entries: readonly FixtureEntry[]): readonly string[] {
  const byModel = new Map(entries.map((e) => [e.model.toLowerCase(), e]));
  const result: string[] = [];
  const seen = new Set<string>([entry.model.toLowerCase()]);
  const stack: FixtureEntry[] = [entry];
  while (stack.length > 0) {
    const current = stack.pop() as FixtureEntry;
    const directParents = (current.params?.fields ?? []).map((field) => field.fixtureModel).filter((parent): parent is string => parent !== undefined && parent.length > 0);
    for (const parent of directParents) {
      const key = parent.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(parent);
        const parentEntry = byModel.get(key);
        if (parentEntry !== undefined) {
          stack.push(parentEntry);
        }
      }
    }
  }
  return result;
}

/**
 * Inputs to {@link collectHotspots}.
 */
interface CollectHotspotsConfig {
  readonly catalog: DiscoveredSpecCatalog;
  readonly apiAbs: string;
  readonly model: string;
  readonly parentModels: readonly string[];
  readonly prefix: string | undefined;
  readonly knownFixtureNames: readonly string[] | undefined;
}

/**
 * Parses every discovered spec and collects those whose fixture nodes reference
 * the target model or one of its parents.
 *
 * @param config - The catalog + parse context.
 * @returns The unsorted hotspots.
 */
async function collectHotspots(config: CollectHotspotsConfig): Promise<ModelTestHotspot[]> {
  const { catalog, apiAbs, model, parentModels, prefix, knownFixtureNames } = config;
  const hotspots: ModelTestHotspot[] = [];
  for (const group of catalog.groups) {
    for (const file of group.files) {
      const text = await readSpecText(apiAbs, catalog.apiRel, file.fileRel);
      if (text === undefined) {
        continue;
      }
      const tree = extractSpecTreeFromText({ text, specPath: file.fileRel, prefix, knownFixtureNames });
      const directHits = searchSpecTree(tree, { mode: 'model', value: model }).hits;
      const parentHits = parentModels.flatMap((parent) => searchSpecTree(tree, { mode: 'model', value: parent }).hits);
      if (directHits.length > 0 || parentHits.length > 0) {
        hotspots.push({ fileRel: file.fileRel, bucket: bucketForKind(file.classification.kind), directRefs: directHits.length, parentRefs: parentHits.length, hits: [...directHits, ...parentHits] });
      }
    }
  }
  return hotspots;
}

/**
 * Reads a discovered spec file's text by its caller-relative path, returning
 * `undefined` if it can't be read.
 *
 * @param apiAbs - Absolute API-app path.
 * @param apiRel - Caller-relative API-app path (the `fileRel` prefix).
 * @param fileRel - Caller-relative spec-file path.
 * @returns The file text, or `undefined`.
 */
async function readSpecText(apiAbs: string, apiRel: string, fileRel: string): Promise<string | undefined> {
  const appRelative = fileRel.startsWith(`${apiRel}/`) ? fileRel.slice(apiRel.length + 1) : fileRel;
  let result: string | undefined;
  try {
    result = await readFile(join(apiAbs, appRelative), 'utf8');
  } catch {
    result = undefined;
  }
  return result;
}

/**
 * Orders hotspots: files with direct (own-fixture) references first, then by
 * total reference count, then by path for stable output.
 *
 * @param a - First hotspot.
 * @param b - Second hotspot.
 * @returns The comparator result.
 */
function compareHotspots(a: ModelTestHotspot, b: ModelTestHotspot): number {
  const byDirect = (a.directRefs > 0 ? 0 : 1) - (b.directRefs > 0 ? 0 : 1);
  const byTotal = b.directRefs + b.parentRefs - (a.directRefs + a.parentRefs);
  const byName = a.fileRel.localeCompare(b.fileRel);
  return byDirect || byTotal || byName;
}

/**
 * Inputs to {@link resolveGroup}.
 */
interface ResolveGroupConfig {
  readonly model: string;
  readonly parentModels: readonly string[];
  readonly catalog: DiscoveredSpecCatalog;
}

/**
 * Resolves the model's function group: the first of [model, …parents] that
 * matches an existing `function/<group>/` folder, falling back to the top-most
 * parent (or the model) lowercased.
 *
 * @param config - The model + parents + discovered catalog.
 * @returns The resolved group name.
 */
function resolveGroup(config: ResolveGroupConfig): string {
  const { model, parentModels, catalog } = config;
  const existing = new Set(catalog.groups.map((group) => group.group.toLowerCase()));
  const candidates = [model, ...parentModels].map((name) => name.toLowerCase());
  const matched = candidates.find((candidate) => existing.has(candidate));
  return matched ?? candidates[candidates.length - 1] ?? model.toLowerCase();
}

/**
 * Collapses a {@link SpecFileKind} into its crud/scenario bucket.
 *
 * @param kind - The classified spec-file kind.
 * @returns The bucket.
 */
function bucketForKind(kind: SpecFileKind): SpecBucket {
  let result: SpecBucket = 'other';
  if (kind.startsWith('crud')) {
    result = 'crud';
  } else if (kind.startsWith('scenario')) {
    result = 'scenario';
  }
  return result;
}
