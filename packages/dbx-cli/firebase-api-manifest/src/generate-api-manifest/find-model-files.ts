/**
 * Walks a source package's `src/lib/**\/*.ts` and returns the per-file
 * model-extraction outputs produced by
 * {@link @dereekb/dbx-cli/manifest-extract#extractModelsFromSource}.
 *
 * Sibling to `find-api-files.ts` — runs the same kind of bounded recursive
 * walk but excludes API/spec/test files and skips files that don't mention
 * `firestoreModelIdentity` or `@dbxModelGroup` (a cheap pre-filter that
 * keeps the walker off third-party files like `dist/`-shipped types).
 *
 * Per-file extractions are aggregated into a global registry by the
 * orchestrator (`main.ts`) so cross-file converter consts can be resolved.
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
 * Walks `packageRoot/src/lib/**\/*.ts` (excluding `.api.ts`, `.spec.ts`,
 * `.test.ts`, and `.id.ts`) and returns every file with at least one
 * extracted model artifact.
 *
 * Files that do not mention `firestoreModelIdentity(` or `@dbxModelGroup`
 * are pre-filtered without paying the ts-morph parse cost.
 *
 * @param packageRoot - Absolute path to the source package's root directory.
 * @returns One {@link ModelFileMatch} per qualifying file.
 */
export function findModelFiles(packageRoot: string): ModelFileMatch[] {
  const libRoot = join(packageRoot, 'src', 'lib');
  const out: ModelFileMatch[] = [];

  if (safeIsDirectory(libRoot)) {
    for (const filePath of walkSourceFiles(libRoot)) {
      const text = readFileSync(filePath, 'utf8');
      if (!textHasModelMarker(text)) continue;
      const extraction = extractModelsFromSource({ name: filePath, text });
      if (extraction.identities.length === 0 && extraction.modelGroups.length === 0 && extraction.converters.length === 0 && extraction.serviceFactories.length === 0) continue;
      out.push({ filePath, extraction });
    }
  }

  return out;
}

function textHasModelMarker(text: string): boolean {
  // Source files that hold model definitions, converters, model-group containers, or
  // `@dbxModelServiceFactory`-tagged factories we care about. Files like helpers/utility files
  // that import none of these are skipped to keep the ts-morph parse off the hot path.
  return text.includes('firestoreModelIdentity(') || text.includes('@dbxModelGroup') || text.includes('snapshotConverterFunctions') || text.includes('firestoreSubObject') || text.includes('firestoreObjectArray') || text.includes('@dbxModelServiceFactory');
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

function isCandidateSourceFile(name: string): boolean {
  return name.endsWith('.ts') && !name.endsWith('.api.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.test.ts') && !name.endsWith('.id.ts') && !name.endsWith('.d.ts');
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
