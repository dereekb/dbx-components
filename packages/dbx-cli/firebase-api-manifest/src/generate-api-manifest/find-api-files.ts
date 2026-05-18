/**
 * Walks a package's `src/lib/**\/*.api.{ts,d.ts}` and returns the files that
 * declare an abstract `*Functions` class along with the class name. Used to
 * map a class identifier from `<APP>_FIREBASE_FUNCTIONS_CONFIG` back to the
 * source `*.api.ts` (in workspace packages) or distributed `*.api.d.ts` (in
 * `node_modules` installs of `@dereekb/*`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { extractCrudEntries } from '@dereekb/dbx-cli/manifest-extract';
import type { ApiFileMatch } from './types';

/**
 * Walks `packageRoot/src/lib/**\/*.api.{ts,d.ts}` and returns the files that
 * declare an abstract `*Functions` class along with the class name and the
 * extracted CRUD entries.
 *
 * Files that declare the abstract class but no `*ModelCrudFunctionsConfig`
 * (e.g. `development.api.ts`) are still returned with `extraction.entries`
 * empty — the caller decides whether to skip them silently or warn.
 *
 * @param packageRoot - Absolute path to the source package's root directory.
 * @returns One {@link ApiFileMatch} per qualifying `.api.{ts,d.ts}`.
 */
export function findApiFiles(packageRoot: string): ApiFileMatch[] {
  const libRoot = join(packageRoot, 'src', 'lib');
  const out: ApiFileMatch[] = [];

  if (safeIsDirectory(libRoot)) {
    const seenClassNames = new Set<string>();
    for (const file of walkApiFiles(libRoot)) {
      const text = readFileSync(file, 'utf8');
      const extraction = extractCrudEntries({ name: file, text });
      if (!extraction.functionsClassName) continue;
      // Source `.api.ts` and its sibling `.api.d.ts` both exist when scanning a
      // local workspace package after a build — keep the first hit (source wins
      // because the walker visits `.api.ts` first via lexical order).
      if (seenClassNames.has(extraction.functionsClassName)) continue;
      seenClassNames.add(extraction.functionsClassName);
      out.push({ filePath: file, className: extraction.functionsClassName, extraction });
    }
  }

  return out;
}

function* walkApiFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir).sort()) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const p = join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      yield* walkApiFiles(p);
    } else if (isApiFile(entry)) {
      yield p;
    }
  }
}

function isApiFile(name: string): boolean {
  const isSpec = name.endsWith('.spec.ts') || name.endsWith('.test.ts');
  return !isSpec && (name.endsWith('.api.ts') || name.endsWith('.api.d.ts'));
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
