/**
 * Public entry point for the rich Firebase-model ts-morph extractor.
 *
 * Walks every `.ts` file under `rootDir` (skipping `*.spec.ts`, `*.test.ts`,
 * and `*.id.ts` as the build-time `.mjs` extractor does), parses each into an
 * in-memory ts-morph project, and assembles {@link FirebaseModel} +
 * {@link FirebaseModelGroup} entries with full parity to the upstream
 * `scripts/extract-firebase-models.mjs`.
 *
 * Used by:
 *   - the runtime downstream-models cache to scan
 *     `components/<x>-firebase` packages on first use
 *   - `dbx_model_list_component`'s thin extractor (after refactor)
 *
 * The build-time `.mjs` script remains the canonical source for the
 * upstream `firebase-models.generated.{json,ts}` catalog. A parity spec
 * keeps the two implementations in lock-step on the upstream model corpus.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, posix, relative, sep } from 'node:path';
import { Project } from 'ts-morph';
import type { FirebaseModel, FirebaseModelGroup } from '../../registry/firebase-models.js';
import { assembleFile } from './assemble.js';
import { findConverters } from './find-converters.js';
import { findEnums } from './find-enums.js';
import { findIdentities } from './find-identities.js';
import { findInterfaces } from './find-interfaces.js';
import { findModelGroups } from './find-model-groups.js';
import { findCollectionFactoryCalls } from './infer-collection-kind.js';

/**
 * Outcome of one model-root scan. The `errors` array carries per-file
 * failures so an individual malformed file never blocks the rest.
 */
export interface ExtractModelsResult {
  readonly models: readonly FirebaseModel[];
  readonly modelGroups: readonly FirebaseModelGroup[];
  readonly errors: readonly { readonly sourceFile: string; readonly message: string }[];
}

/**
 * Configuration for {@link extractModels}.
 */
export interface ExtractModelsInput {
  /**
   * Absolute path to the model-root directory. Typically
   * `<componentRoot>/src/lib/model` for downstream packages, or
   * `packages/firebase/src/lib/model` for the upstream catalog.
   */
  readonly rootDir: string;
  /**
   * The `sourcePackage` value to stamp on every produced entry
   * (e.g. `'@dereekb/firebase'` or `'demo-firebase'`).
   */
  readonly sourcePackage: string;
  /**
   * Workspace root used to compute the workspace-relative `sourceFile`
   * field on each entry. When omitted, the path is computed relative to
   * `rootDir`'s parent (rare — only useful for ad-hoc tests).
   */
  readonly workspaceRoot?: string;
  /**
   * Reserved top-level folder names to skip during the walk
   * (e.g. `system`, `notification`, `storagefile`). Files inside reserved
   * folders are excluded from the scan.
   *
   * Provide the {@link RESERVED_MODEL_FOLDERS} set when scanning a
   * downstream package that extends shared groups via dedicated
   * validators; pass an empty array (or omit) when scanning the upstream
   * `@dereekb/firebase` source where the same folders host the canonical
   * group implementations.
   */
  readonly skipReservedFolders?: readonly string[];
}

/**
 * Scans the supplied model root and returns every detected model and
 * model-group entry. Per-file errors are aggregated rather than thrown so
 * a single malformed file never blocks the rest of the scan.
 *
 * @param input - the scan configuration
 * @returns the assembled models, groups, and per-file errors
 */
export async function extractModels(input: ExtractModelsInput): Promise<ExtractModelsResult> {
  const { rootDir, sourcePackage, workspaceRoot, skipReservedFolders } = input;
  const reserved = new Set(skipReservedFolders ?? []);
  const baseDir = workspaceRoot ?? join(rootDir, '..');
  const files = await listTsFiles(rootDir, reserved);
  const project = new Project({ useInMemoryFileSystem: true });

  const models: FirebaseModel[] = [];
  const modelGroups: FirebaseModelGroup[] = [];
  const errors: { readonly sourceFile: string; readonly message: string }[] = [];

  for (const filePath of files) {
    const sourceFileRel = relative(baseDir, filePath).split(sep).join(posix.sep);
    try {
      const text = await readFile(filePath, 'utf8');
      if (!text.includes('firestoreModelIdentity(') && !text.includes('@dbxModelGroup')) {
        continue;
      }
      const sf = project.createSourceFile(`/scan/${basename(filePath)}-${models.length}-${modelGroups.length}.ts`, text, { overwrite: true });
      const assembled = assembleFile({
        sourcePackage,
        sourceFile: sourceFileRel,
        identities: findIdentities(sf),
        interfaces: findInterfaces(sf),
        converters: findConverters(sf),
        enums: findEnums(sf),
        modelGroups: findModelGroups(sf),
        factoryKinds: findCollectionFactoryCalls(sf)
      });
      for (const m of assembled.models) models.push(m);
      for (const g of assembled.modelGroups) modelGroups.push(g);
    } catch (error) {
      errors.push({ sourceFile: sourceFileRel, message: error instanceof Error ? error.message : String(error) });
    }
  }

  models.sort((a, b) => {
    const aRoot = a.parentIdentityConst ? 1 : 0;
    const bRoot = b.parentIdentityConst ? 1 : 0;
    if (aRoot !== bRoot) return aRoot - bRoot;
    return a.name.localeCompare(b.name);
  });
  modelGroups.sort((a, b) => a.name.localeCompare(b.name));

  return { models, modelGroups, errors };
}

async function listTsFiles(rootDir: string, reserved: ReadonlySet<string>): Promise<readonly string[]> {
  const out: string[] = [];
  await walk(rootDir, rootDir, reserved, out);
  out.sort();
  return out;
}

async function walk(currentDir: string, rootDir: string, reserved: ReadonlySet<string>, out: string[]): Promise<void> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      // Reserved folders only apply at the top level — same as `dbx_model_list_component`'s walk.
      if (currentDir === rootDir && reserved.has(entry.name)) continue;
      await walk(full, rootDir, reserved, out);
    } else if (entry.isFile()) {
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts') || entry.name.endsWith('.id.ts')) continue;
      try {
        const stats = await stat(full);
        if (stats.isFile()) out.push(full);
      } catch {
        // skip unreadable file
      }
    }
  }
}
