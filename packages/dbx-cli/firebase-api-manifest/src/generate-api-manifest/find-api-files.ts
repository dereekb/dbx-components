/**
 * Walks a package's `src/lib/**\/*.api.ts` and returns the files that declare
 * an abstract `*Functions` class along with the class name. Used to map a
 * class identifier from `<APP>_FIREBASE_FUNCTIONS_CONFIG` back to the source
 * `*.api.ts`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { extractCrudEntries } from './extract-crud';
import type { ApiFileMatch } from './types';

/**
 * Marker that must be present in a `.api.ts` text for it to be considered a
 * candidate (avoids false positives on unrelated files).
 */
const REQUIRED_MARKER = 'callModelFirebaseFunctionMapFactory';

/**
 * Walks `packageRoot/src/lib/**\/*.api.ts` and returns the files that declare
 * an abstract `*Functions` class along with the class name and the
 * extracted CRUD entries.
 *
 * @param packageRoot - Absolute path to the source package's root directory.
 * @returns One {@link ApiFileMatch} per qualifying `.api.ts`.
 */
export function findApiFiles(packageRoot: string): ApiFileMatch[] {
  const libRoot = join(packageRoot, 'src', 'lib');
  if (!safeIsDirectory(libRoot)) return [];

  const out: ApiFileMatch[] = [];
  for (const file of walkApiFiles(libRoot)) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes(REQUIRED_MARKER)) continue;
    const extraction = extractCrudEntries({ name: file, text });
    if (!extraction.functionsClassName) continue;
    out.push({ filePath: file, className: extraction.functionsClassName, extraction });
  }
  return out;
}

function* walkApiFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const p = join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      yield* walkApiFiles(p);
    } else if (entry.endsWith('.api.ts') && !entry.endsWith('.spec.ts')) {
      yield p;
    }
  }
}

function safeIsDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
