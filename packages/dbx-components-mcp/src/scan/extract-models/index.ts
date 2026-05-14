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
import { Project, type SourceFile } from 'ts-morph';
import type { FirebaseModel, FirebaseModelGroup } from '../../registry/firebase-models.js';
import { assembleFile, type SubObjectConstEntry } from './assemble.js';
import { findConverters } from './find-converters.js';
import { findEnums } from './find-enums.js';
import { findIdentities } from './find-identities.js';
import { findInterfaces } from './find-interfaces.js';
import { findModelGroups } from './find-model-groups.js';
import { findSubObjectConsts } from './find-sub-object-consts.js';
import { findCollectionFactoryCalls } from './infer-collection-kind.js';
import type { ExtractedInterface } from './types.js';

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

interface ParsedSourceFile {
  readonly filePath: string;
  readonly sourceFileRel: string;
  readonly sf: SourceFile;
  readonly hasModelMarker: boolean;
}

interface ExtractError {
  readonly sourceFile: string;
  readonly message: string;
}

function resolveFactoryKind(factoryName: string): 'object' | 'array' | 'map' {
  let kind: 'object' | 'array' | 'map';
  if (factoryName === 'firestoreSubObject') {
    kind = 'object';
  } else if (factoryName === 'firestoreObjectArray') {
    kind = 'array';
  } else {
    kind = 'map';
  }
  return kind;
}

function indexSubObjectFactsFromFile(sf: SourceFile, subObjectConstIndex: Map<string, SubObjectConstEntry>, subObjectInterfaceIndex: Map<string, ExtractedInterface>): void {
  for (const c of findSubObjectConsts(sf)) {
    if (!subObjectConstIndex.has(c.constName)) {
      subObjectConstIndex.set(c.constName, { interfaceName: c.interfaceName, factoryKind: resolveFactoryKind(c.factoryName) });
    }
  }
  for (const iface of findInterfaces(sf)) {
    if (iface.tags.dbxModelSubObject && !subObjectInterfaceIndex.has(iface.name)) {
      subObjectInterfaceIndex.set(iface.name, iface);
    }
  }
}

function fileHasAnyMarker(text: string): { readonly hasModelMarker: boolean; readonly hasSubObjectMarker: boolean } {
  const hasModelMarker = text.includes('firestoreModelIdentity(') || text.includes('@dbxModelGroup');
  const hasSubObjectMarker = text.includes('@dbxModelSubObject') || text.includes('firestoreSubObject') || text.includes('firestoreObjectArray') || text.includes('firestoreMap');
  return { hasModelMarker, hasSubObjectMarker };
}

interface ParseAndIndexInput {
  readonly files: readonly string[];
  readonly baseDir: string;
  readonly project: Project;
  readonly subObjectConstIndex: Map<string, SubObjectConstEntry>;
  readonly subObjectInterfaceIndex: Map<string, ExtractedInterface>;
}

interface ParseAndIndexResult {
  readonly parsedFiles: readonly ParsedSourceFile[];
  readonly errors: readonly ExtractError[];
}

async function parseAndIndexFiles(input: ParseAndIndexInput): Promise<ParseAndIndexResult> {
  const { files, baseDir, project, subObjectConstIndex, subObjectInterfaceIndex } = input;
  const parsedFiles: ParsedSourceFile[] = [];
  const errors: ExtractError[] = [];
  for (const filePath of files) {
    const sourceFileRel = relative(baseDir, filePath).split(sep).join(posix.sep);
    try {
      const text = await readFile(filePath, 'utf8');
      const { hasModelMarker, hasSubObjectMarker } = fileHasAnyMarker(text);
      if (!hasModelMarker && !hasSubObjectMarker) {
        continue;
      }
      const sf = project.createSourceFile(`/scan/${basename(filePath)}-${parsedFiles.length}.ts`, text, { overwrite: true });
      parsedFiles.push({ filePath, sourceFileRel, sf, hasModelMarker });
      indexSubObjectFactsFromFile(sf, subObjectConstIndex, subObjectInterfaceIndex);
    } catch (error) {
      errors.push({ sourceFile: sourceFileRel, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { parsedFiles, errors };
}

interface AssemblePassInput {
  readonly parsedFiles: readonly ParsedSourceFile[];
  readonly sourcePackage: string;
  readonly subObjectConstIndex: Map<string, SubObjectConstEntry>;
  readonly subObjectInterfaceIndex: Map<string, ExtractedInterface>;
}

interface AssemblePassResult {
  readonly models: readonly FirebaseModel[];
  readonly modelGroups: readonly FirebaseModelGroup[];
  readonly errors: readonly ExtractError[];
}

function assembleAllParsedFiles(input: AssemblePassInput): AssemblePassResult {
  const { parsedFiles, sourcePackage, subObjectConstIndex, subObjectInterfaceIndex } = input;
  const models: FirebaseModel[] = [];
  const modelGroups: FirebaseModelGroup[] = [];
  const errors: ExtractError[] = [];
  for (const { sourceFileRel, sf, hasModelMarker } of parsedFiles) {
    if (!hasModelMarker) continue;
    try {
      const assembled = assembleFile({
        sourcePackage,
        sourceFile: sourceFileRel,
        identities: findIdentities(sf),
        interfaces: findInterfaces(sf),
        converters: findConverters(sf),
        enums: findEnums(sf),
        modelGroups: findModelGroups(sf),
        factoryKinds: findCollectionFactoryCalls(sf),
        subObjectConstIndex,
        subObjectInterfaceIndex
      });
      for (const m of assembled.models) models.push(m);
      for (const g of assembled.modelGroups) modelGroups.push(g);
    } catch (error) {
      errors.push({ sourceFile: sourceFileRel, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { models, modelGroups, errors };
}

function sortModels(models: FirebaseModel[]): void {
  models.sort((a, b) => {
    const aRoot = a.parentIdentityConst ? 1 : 0;
    const bRoot = b.parentIdentityConst ? 1 : 0;
    if (aRoot !== bRoot) return aRoot - bRoot;
    return a.name.localeCompare(b.name);
  });
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

  // Pre-pass: parse every file once and collect the cross-file
  // sub-object index (factory consts + tagged interfaces) so the
  // per-model assembly pass can resolve `firestoreSubObject<T>` chains
  // declared in sibling sub-files (e.g. `worker.pay.ts` consumed by
  // `worker.ts`).
  const subObjectConstIndex = new Map<string, SubObjectConstEntry>();
  const subObjectInterfaceIndex = new Map<string, ExtractedInterface>();
  const parsePass = await parseAndIndexFiles({ files, baseDir, project, subObjectConstIndex, subObjectInterfaceIndex });
  const assemblePass = assembleAllParsedFiles({ parsedFiles: parsePass.parsedFiles, sourcePackage, subObjectConstIndex, subObjectInterfaceIndex });

  const models: FirebaseModel[] = [...assemblePass.models];
  const modelGroups: FirebaseModelGroup[] = [...assemblePass.modelGroups];
  const errors: ExtractError[] = [...parsePass.errors, ...assemblePass.errors];

  sortModels(models);
  modelGroups.sort((a, b) => a.name.localeCompare(b.name));

  return { models, modelGroups, errors };
}

async function listTsFiles(rootDir: string, reserved: ReadonlySet<string>): Promise<readonly string[]> {
  const out: string[] = [];
  await walk({ currentDir: rootDir, rootDir, reserved, out });
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

interface WalkInput {
  readonly currentDir: string;
  readonly rootDir: string;
  readonly reserved: ReadonlySet<string>;
  readonly out: string[];
}

async function walk(input: WalkInput): Promise<void> {
  const { currentDir, rootDir, reserved, out } = input;
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
      await walk({ currentDir: full, rootDir, reserved, out });
    } else if (entry.isFile()) {
      await collectIfSourceFile(entry.name, full, out);
    }
  }
}

async function collectIfSourceFile(name: string, full: string, out: string[]): Promise<void> {
  if (!name.endsWith('.ts')) return;
  if (name.endsWith('.spec.ts') || name.endsWith('.test.ts') || name.endsWith('.id.ts')) return;
  try {
    const stats = await stat(full);
    if (stats.isFile()) out.push(full);
  } catch {
    // skip unreadable file
  }
}
