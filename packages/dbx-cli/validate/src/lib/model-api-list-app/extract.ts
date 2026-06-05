/**
 * Extractor for `dbx_model_api_list_app`. Walks a firebase-component package's
 * `src/lib/**\/*.api.ts` files and runs the shared CRUD-entry walker on each.
 *
 * Files without a `callModelFirebaseFunctionMapFactory(...)` call are skipped
 * silently (mirrors `model-validate-api`'s convention so non-CRUD api files
 * like `development.api.ts` don't pollute the output).
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { type Dirent } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { extractCrudEntries, type CrudVerb } from '@dereekb/dbx-cli/manifest-extract';
import type { ApiListEntry, ApiListFileSummary, ApiListVerbCounts } from './types.js';

const API_SUFFIX = '.api.ts';
const MODEL_SUBPATH = 'src/lib';

export interface ExtractApiListInput {
  readonly componentAbs: string;
  readonly componentDir: string;
  readonly modelFilter?: string;
}

export interface ExtractApiListResult {
  readonly modelRoot: string;
  readonly entries: readonly ApiListEntry[];
  readonly files: readonly ApiListFileSummary[];
}

/**
 * Walks the component package and extracts every CRUD / standalone entry from
 * each `<model>.api.ts` source. Best-effort: missing factory calls produce
 * empty entries lists rather than throwing.
 *
 * @param input - Component absolute path, relative path, and optional filter.
 * @returns The entries and per-file summaries.
 */
export async function extractApiList(input: ExtractApiListInput): Promise<ExtractApiListResult> {
  const modelRoot = join(input.componentAbs, MODEL_SUBPATH);
  const apiFiles = await collectApiFiles(modelRoot);
  const entries: ApiListEntry[] = [];
  const files: ApiListFileSummary[] = [];

  for (const filePath of apiFiles) {
    const text = await readFile(filePath, 'utf8');
    if (!text.includes('callModelFirebaseFunctionMapFactory')) {
      continue;
    }
    const sourceFileRel = relative(input.componentAbs, filePath).split(sep).join('/');
    const extraction = extractCrudEntries({ name: sourceFileRel, text });
    const fileEntries: ApiListEntry[] = extraction.entries.map((entry) => ({ ...entry, sourceFile: sourceFileRel }));
    const counts = countVerbs(fileEntries);
    files.push({
      sourceFile: sourceFileRel,
      groupName: extraction.groupName,
      modelKeys: extraction.modelKeys,
      counts
    });
    if (input.modelFilter === undefined) {
      entries.push(...fileEntries);
    } else {
      const wanted = normalize(input.modelFilter);
      for (const entry of fileEntries) {
        if (matchesModelFilter(entry.model, extraction.groupName, wanted)) {
          entries.push(entry);
        }
      }
    }
  }

  return { modelRoot, entries, files };
}

/**
 * Reads a directory's `Dirent` entries; returns an empty list when the
 * path is unreadable.
 *
 * @param path - Absolute directory path.
 * @returns The directory entries or `[]` on failure.
 */
async function readDirSafe(path: string): Promise<readonly Dirent[]> {
  let result: readonly Dirent[];
  try {
    result = await readdir(path, { withFileTypes: true });
  } catch {
    result = [];
  }
  return result;
}

async function collectApiFiles(root: string): Promise<readonly string[]> {
  const out: string[] = [];
  const stack: string[] = [];
  let isDir = false;
  try {
    const stats = await stat(root);
    isDir = stats.isDirectory();
  } catch {
    isDir = false;
  }
  if (isDir) {
    stack.push(root);
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
          out.push(full);
        }
      }
    }
    out.sort((a, b) => a.localeCompare(b));
  }
  return out;
}

function countVerbs(entries: readonly ApiListEntry[]): ApiListVerbCounts {
  const counts: Record<CrudVerb, number> = { create: 0, read: 0, update: 0, delete: 0, query: 0, invoke: 0, standalone: 0 };
  for (const entry of entries) {
    counts[entry.verb] += 1;
  }
  return counts;
}

function normalize(value: string): string {
  return value.replace(/Identity$/i, '').toLowerCase();
}

function matchesModelFilter(model: string, groupName: string | undefined, wanted: string): boolean {
  if (model.toLowerCase() === wanted) {
    return true;
  }
  if (groupName?.toLowerCase() === wanted) {
    return true;
  }
  return false;
}
