/**
 * Filesystem inspection for `dbx_validate_model_folder`.
 *
 * Resolves a folder path, stats it, and reads its direct `.ts` children
 * into a {@link FolderInspection}. Pure rules consume the inspection
 * result — specs build inspections directly without touching the disk.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { FolderInspection, FolderInspectionStatus, ModelFolderSource } from './types.js';

/**
 * `.ts` filename suffixes we exclude from content validation. The
 * folder's canonical sub-files (id types, query helpers, action wiring,
 * api endpoints) plus tests never carry `firestoreModelIdentity` calls,
 * so reading them just wastes I/O — the content validator would skip
 * them anyway via the `models.length === 0` short-circuit. `index.ts`
 * is a barrel, also irrelevant.
 */
const CONTENT_VALIDATION_SKIP_SUFFIXES: readonly string[] = ['.spec.ts', '.id.ts', '.query.ts', '.action.ts', '.api.ts'];

/**
 * Stats a folder and lists its direct `.ts` children, capturing enough
 * filesystem state for the pure rules to validate against. Also reads the
 * contents of any `.ts` file likely to declare a model so the rules layer
 * can run the per-file content validator without re-touching the disk.
 * Specs construct inspections directly without using this function.
 *
 * @param path - absolute path to the folder to inspect
 * @returns the inspection record describing the folder's status and contents
 */
export async function inspectFolder(path: string): Promise<FolderInspection> {
  const name = basename(path);
  let status: FolderInspectionStatus;
  let files: readonly string[] = [];
  let sources: readonly ModelFolderSource[] = [];
  try {
    const stats = await stat(path);
    if (stats.isDirectory()) {
      status = 'ok';
      const entries = await readdir(path, { withFileTypes: true });
      const collected: string[] = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.ts')) continue;
        collected.push(entry.name);
      }
      files = collected;
      sources = await readModelSources(path, collected);
    } else {
      status = 'not-directory';
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      status = 'not-found';
    } else {
      throw err;
    }
  }
  const result: FolderInspection = { name, path, status, files, sources };
  return result;
}

async function readModelSources(folderPath: string, files: readonly string[]): Promise<readonly ModelFolderSource[]> {
  const out: ModelFolderSource[] = [];
  for (const filename of files) {
    if (filename === 'index.ts') continue;
    if (CONTENT_VALIDATION_SKIP_SUFFIXES.some((suffix) => filename.endsWith(suffix))) continue;
    const text = await readFile(join(folderPath, filename), 'utf8');
    out.push({ filename, text });
  }
  return out;
}
