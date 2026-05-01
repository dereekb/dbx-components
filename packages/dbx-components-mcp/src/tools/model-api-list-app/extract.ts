/**
 * Extractor for `dbx_model_api_list_app`. Walks a firebase-component package's
 * `src/lib/**\/*.api.ts` files and runs the shared CRUD-entry walker on each.
 *
 * Files without a `callModelFirebaseFunctionMapFactory(...)` call are skipped
 * silently (mirrors `model-validate-api`'s convention so non-CRUD api files
 * like `development.api.ts` don't pollute the output).
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { extractCrudEntries } from '../model-api-shared/index.js';
import type { ApiListEntry, ApiListFileSummary, ApiListVerbCounts } from './types.js';
import type { CrudVerb } from '../model-api-shared/types.js';

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
 * @param input - component absolute path, relative path, and optional filter
 * @returns the entries and per-file summaries
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
    if (input.modelFilter !== undefined) {
      const wanted = normalize(input.modelFilter);
      for (const entry of fileEntries) {
        if (matchesModelFilter(entry.model, extraction.groupName, wanted)) {
          entries.push(entry);
        }
      }
    } else {
      entries.push(...fileEntries);
    }
  }

  return { modelRoot, entries, files };
}

async function collectApiFiles(root: string): Promise<readonly string[]> {
  const out: string[] = [];
  const stack: string[] = [];
  try {
    const stats = await stat(root);
    if (!stats.isDirectory()) {
      return out;
    }
    stack.push(root);
  } catch {
    return out;
  }
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (entry.name.endsWith(API_SUFFIX) && !entry.name.endsWith('.spec.ts')) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function countVerbs(entries: readonly ApiListEntry[]): ApiListVerbCounts {
  const counts: Record<CrudVerb, number> = { create: 0, read: 0, update: 0, delete: 0, query: 0, standalone: 0 };
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
  if (groupName && groupName.toLowerCase() === wanted) {
    return true;
  }
  return false;
}
