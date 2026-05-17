/**
 * Walks one or more source roots looking for `<model>.api.ts` files and
 * emits one {@link DeclaredEntry} per CRUD leaf (standalone entries are
 * skipped — they are not registered through the verb-keyed `<X>ModelMap`
 * constants the validator reconciles against).
 *
 * Each source root is paired with a `relativeBase`: the absolute directory
 * that produced `sourceFile` paths should be relative to. Callers typically
 * pass the workspace root so that emitted paths stay stable across
 * component-internal and upstream-package declarations.
 */

import { readdir, readFile, stat, type Dirent } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { extractCrudEntries } from '../model-api-shared/index.js';
import type { DeclaredEntry } from './types.js';

const API_SUFFIX = '.api.ts';

export interface DeclaredEntriesSourceRoot {
  /**
   * Absolute directory to walk for `*.api.ts` files.
   */
  readonly absDir: string;
  /**
   * Absolute base path that emitted `sourceFile` strings should be relative to.
   */
  readonly relativeBase: string;
}

/**
 * Walks every supplied source root, reads each `<model>.api.ts` file, and emits one {@link DeclaredEntry} per CRUD leaf.
 *
 * @param roots - The source roots to walk; each pairs an absolute walk
 *   directory with the absolute base used to compute relative source paths.
 * @returns The CRUD declarations discovered across all roots.
 */
/**
 * Reads one `<model>.api.ts` file and emits the CRUD declarations it
 * contributes. Skips files without the
 * `callModelFirebaseFunctionMapFactory` marker so unrelated `.api.ts`
 * files aren't parsed.
 *
 * @param fileAbs - Absolute path to the API source file.
 * @param root - Source root used to compute the relative path string.
 * @returns The declared CRUD entries from this file (empty when none)
 */
async function extractDeclaredEntriesFromFile(fileAbs: string, root: DeclaredEntriesSourceRoot): Promise<readonly DeclaredEntry[]> {
  const text = await readFile(fileAbs, 'utf8');
  if (!text.includes('callModelFirebaseFunctionMapFactory')) return [];
  const fileRel = relative(root.relativeBase, fileAbs).split(sep).join('/');
  const extraction = extractCrudEntries({ name: fileRel, text });
  const out: DeclaredEntry[] = [];
  for (const entry of extraction.entries) {
    if (entry.verb === 'standalone') continue;
    out.push({
      model: entry.model,
      verb: entry.verb,
      specifier: entry.specifier,
      paramsTypeName: entry.paramsTypeName,
      resultTypeName: entry.resultTypeName,
      sourceFile: fileRel,
      line: entry.line
    });
  }
  return out;
}

/**
 * Walks every supplied source root, reads each `<model>.api.ts` file,
 * and emits one {@link DeclaredEntry} per CRUD leaf.
 *
 * @param roots - The source roots to walk; each pairs an absolute walk
 *   directory with the absolute base used to compute relative source paths.
 * @returns The CRUD declarations discovered across all roots.
 */
export async function extractDeclaredEntries(roots: readonly DeclaredEntriesSourceRoot[]): Promise<readonly DeclaredEntry[]> {
  const seen = new Set<string>();
  const out: DeclaredEntry[] = [];
  for (const root of roots) {
    const files = await collectApiFiles(root.absDir);
    for (const fileAbs of files) {
      if (seen.has(fileAbs)) continue;
      seen.add(fileAbs);
      const fromFile = await extractDeclaredEntriesFromFile(fileAbs, root);
      out.push(...fromFile);
    }
  }
  return out;
}

/**
 * Reads a directory's `Dirent` entries; returns an empty list when the
 * path is unreadable (e.g. permission denied, race-condition removal).
 *
 * @param path - Absolute directory path.
 * @returns The directory entries or `[]` on failure.
 */
async function readDirSafe(path: string): Promise<readonly Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function collectApiFiles(rootAbs: string): Promise<readonly string[]> {
  const files: string[] = [];
  const stack: string[] = [];
  try {
    const stats = await stat(rootAbs);
    if (!stats.isDirectory()) return [];
    stack.push(rootAbs);
  } catch {
    return [];
  }
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await readDirSafe(current);
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(API_SUFFIX) && !entry.name.endsWith('.spec.ts')) {
        files.push(full);
      }
    }
  }
  files.sort((a, b) => a.localeCompare(b));
  return files;
}
