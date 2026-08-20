/**
 * For a given Params type name (e.g. `SetProfileUsernameParams`), derives the
 * canonical arktype validator identifier (`setProfileUsernameParamsType`) by
 * naming convention and confirms it is exported from the resolved package.
 *
 * Verification is best-effort: we string-search the package's `src/index.ts`
 * and follow `export * from './...';` re-exports recursively until we find
 * the declaration of the validator. The convention everywhere in the codebase
 * is `export const <name>ParamsType = ... as Type<<Name>Params>`.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export { isExportedFromPackage, type IsExportedInput } from '../../../src/lib/scan-helpers/exported-from-package.js';

/**
 * Derives the canonical arktype validator identifier from a Params type name.
 *
 * `SetProfileUsernameParams` → `setProfileUsernameParamsType`.
 *
 * @param paramsTypeName - PascalCase Params type identifier.
 * @returns The lowerCamelCase validator identifier (or empty string for empty input).
 */
export function deriveValidatorName(paramsTypeName: string): string {
  return paramsTypeName ? paramsTypeName.charAt(0).toLowerCase() + paramsTypeName.slice(1) + 'Type' : '';
}

/**
 * Walks the `src/lib` tree under a package and returns the absolute file
 * paths of every `.ts` file (used as a fallback when index-chain lookup
 * misses the identifier — some packages rely on flat barrels that don't
 * `export *`).
 *
 * @param packageRoot - Absolute path to the source package's root directory.
 * @returns Absolute paths of every non-spec `.ts` file under `src`.
 */
export function listPackageTsFiles(packageRoot: string): string[] {
  const libRoot = join(packageRoot, 'src');
  const out: string[] = [];
  if (safeIsDirectory(libRoot)) {
    walk(libRoot, out);
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const p = join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      walk(p, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts') && !entry.endsWith('.test.ts')) {
      out.push(p);
    }
  }
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
