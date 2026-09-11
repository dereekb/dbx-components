/**
 * Walks a source package's `src/lib/**\/*.ts` and returns the per-file
 * model-extraction outputs produced by
 * {@link @dereekb/dbx-cli/manifest-extract#extractModelsFromSource}.
 *
 * Sibling to `find-api-files.ts` — runs the same kind of bounded recursive
 * walk but excludes API/spec/test files and skips files that mention none of
 * the model-declaring markers (a cheap pre-filter that keeps the walker off
 * third-party files like `dist`-shipped types).
 *
 * Per-file extractions are aggregated into a global registry by the
 * orchestrator (`main.ts`) so cross-file converter consts, and cross-file enum
 * references, can be resolved. That is why an ENUM-ONLY file qualifies: a model
 * group routinely declares its enums in a sibling data/id file
 * (`job.data.ts`, `worker.id.ts`) and its converters in the main one, and a
 * converter field's `enumRef` only resolves if both files were scanned.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { extractModelsFromSource, type ModelExtraction } from '@dereekb/dbx-cli/manifest-extract';

/**
 * One source-file-and-its-model-extraction pair returned by
 * {@link findModelFiles}.
 */
export interface ModelFileMatch {
  readonly filePath: string;
  readonly extraction: ModelExtraction;
}

/**
 * Walks `packageRoot/src/lib/**\/*.ts` (excluding `.api.ts`, `.spec.ts`, and
 * `.test.ts`) and returns every file with at least one extracted model
 * artifact — an enum on its own counts.
 *
 * Files mentioning none of the {@link textHasModelMarker} markers are
 * pre-filtered without paying the ts-morph parse cost.
 *
 * @param packageRoot - Absolute path to the source package's root directory.
 * @returns One {@link ModelFileMatch} per qualifying file.
 */
export function findModelFiles(packageRoot: string): ModelFileMatch[] {
  const libRoot = join(packageRoot, 'src', 'lib');
  const out: ModelFileMatch[] = [];

  if (safeIsDirectory(libRoot)) {
    const seenStems = new Set<string>();

    for (const filePath of walkSourceFiles(libRoot)) {
      // A workspace package that has been built carries both `x.ts` and `x.d.ts`. Source wins — it is
      // the only one of the pair that retains the converter field literals — and the walker reaches it
      // first because `.d.ts` sorts after `.ts` on the shared stem.
      const stem = sourceFileStem(filePath);
      if (seenStems.has(stem)) continue;
      const text = readFileSync(filePath, 'utf8');
      if (!textHasModelMarker(text)) continue;
      const extraction = extractModelsFromSource({ name: filePath, text });
      if (!hasExtractedArtifact(extraction)) continue;
      seenStems.add(stem);
      out.push({ filePath, extraction });
    }
  }

  return out;
}

/**
 * The path a `.ts` and its emitted `.d.ts` share, used to keep only one of the pair.
 *
 * @param filePath - Absolute path to the source file.
 * @returns The path with its `.d.ts` / `.ts` extension removed.
 */
function sourceFileStem(filePath: string): string {
  return filePath.replace(/\.d\.ts$/, '').replace(/\.ts$/, '');
}

function textHasModelMarker(text: string): boolean {
  // Source files that hold model definitions, converters, model-group containers,
  // `@dbxModelServiceFactory`-tagged factories, single-item collection factories (which pin a
  // model's fixed document id), or exported enums (a converter one file over may reference them)
  // are the ones we care about. Helper/utility files mentioning none of these are skipped to keep
  // the ts-morph parse off the hot path.
  return (
    text.includes('firestoreModelIdentity(') ||
    // the declared-type form the call leaves behind in a .d.ts. One substring covers all three identity
    // types, since `RootFirestoreModelIdentity` and `FirestoreModelIdentityWithParent` both contain it.
    text.includes('FirestoreModelIdentity') ||
    text.includes('@dbxModelGroup') ||
    text.includes('snapshotConverterFunctions') ||
    text.includes('firestoreSubObject') ||
    text.includes('firestoreObjectArray') ||
    text.includes('@dbxModelServiceFactory') ||
    text.includes('singleItemFirestoreCollection') ||
    text.includes('rootSingleItemFirestoreCollection') ||
    text.includes('export enum ') ||
    text.includes('export declare enum ')
  );
}

/**
 * Whether an extraction carried anything the orchestrator can use. Enums count on their own — an
 * enum-only file is the whole reason a data/id file is scanned.
 *
 * @param extraction - The per-file extraction.
 * @returns `true` when at least one artifact was found.
 */
function hasExtractedArtifact(extraction: ModelExtraction): boolean {
  return extraction.identities.length > 0 || extraction.modelGroups.length > 0 || extraction.converters.length > 0 || extraction.serviceFactories.length > 0 || extraction.singleItemCollections.length > 0 || extraction.enums.length > 0;
}

function* walkSourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir).sort()) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const p = join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      yield* walkSourceFiles(p);
    } else if (isCandidateSourceFile(entry)) {
      yield p;
    }
  }
}

/**
 * Whether a filename is one the model walker parses.
 *
 * `.d.ts` qualifies so a `@dereekb/*` package installed into `node_modules` — which ships declarations
 * and no source — contributes its models rather than silently contributing none. That is the whole
 * reason a framework-declared model used to be missing from the prefix table while its API calls were
 * present: `find-api-files` has always accepted `.api.d.ts`, and this walker did not accept its
 * counterpart.
 *
 * @param name - The file's basename.
 * @returns `true` when the file should be parsed.
 */
function isCandidateSourceFile(name: string): boolean {
  return name.endsWith('.ts') && !name.endsWith('.api.ts') && !name.endsWith('.api.d.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.test.ts');
}

function safeIsDirectory(p: string): boolean {
  let result: boolean;
  try {
    result = statSync(p).isDirectory();
  } catch {
    result = false;
  }
  return result;
}
