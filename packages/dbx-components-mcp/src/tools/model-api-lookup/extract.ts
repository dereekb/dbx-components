/**
 * Walker for `dbx_model_api_lookup`. Resolves the right `<model>.api.ts`
 * source for a model filter, runs the shared CRUD walker, and enriches
 * each entry with action method / factory JSDoc when an `apiDir` was provided.
 *
 * The params- and result-side JSDoc data is sourced directly from the shared
 * walker's {@link CrudEntry} output — this module just maps the boundary
 * (renaming `description` → `jsDoc` so the published `ApiLookupField` shape
 * stays stable).
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { type Dirent } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { extractCrudEntries, type CrudEntry, type CrudEntryDocField } from '../model-api-shared/index.js';
import type { ApiLookupEntry, ApiLookupField, ApiLookupReport, ActionLookupStatus } from './types.js';
import { buildActionLookup } from './extract-actions.js';

const API_SUFFIX = '.api.ts';
const COMPONENT_LIB_SUBPATH = 'src/lib';

export interface ExtractApiLookupInput {
  readonly componentAbs: string;
  readonly componentDir: string;
  readonly apiAbs: string | undefined;
  readonly apiDir: string | undefined;
  readonly modelFilter: string;
}

interface ApiSource {
  readonly fileAbs: string;
  readonly fileRel: string;
  readonly text: string;
}

/**
 * Builds the lookup report for one model filter.
 *
 * @param input - The absolute / relative paths and the model filter.
 * @returns The populated report.
 */
export async function extractApiLookup(input: ExtractApiLookupInput): Promise<ApiLookupReport> {
  const apiSources = await collectApiSources(input.componentAbs);
  const matched = pickMatchingSource(apiSources, input.modelFilter);
  if (!matched) {
    return {
      componentDir: input.componentDir,
      apiDir: input.apiDir,
      groupName: undefined,
      modelFilter: input.modelFilter,
      sourceFile: undefined,
      modelKeys: [],
      entries: [],
      actionLookupStatus: { kind: 'skipped', reason: 'No matching `<model>.api.ts` source found.' }
    };
  }

  const crudExtraction = extractCrudEntries({ name: matched.fileRel, text: matched.text });
  const filteredEntries = crudExtraction.entries.filter((entry) => entryMatchesFilter(entry.model, crudExtraction.groupName, input.modelFilter));

  let actionLookup: Awaited<ReturnType<typeof buildActionLookup>> | undefined;
  let actionLookupStatus: ActionLookupStatus;
  if (input.apiAbs) {
    try {
      actionLookup = await buildActionLookup(input.apiAbs);
      actionLookupStatus = { kind: 'ok', filesScanned: actionLookup.filesScanned };
    } catch (err) {
      actionLookupStatus = { kind: 'error', message: err instanceof Error ? err.message : String(err) };
    }
  } else {
    actionLookupStatus = { kind: 'skipped', reason: 'apiDir not provided — action JSDoc skipped.' };
  }

  const enriched: ApiLookupEntry[] = filteredEntries.map((entry) => mapEntry(entry, matched.fileRel, actionLookup));

  return {
    componentDir: input.componentDir,
    apiDir: input.apiDir,
    groupName: crudExtraction.groupName,
    modelFilter: input.modelFilter,
    sourceFile: matched.fileRel,
    modelKeys: crudExtraction.modelKeys,
    entries: enriched,
    actionLookupStatus
  };
}

function mapEntry(entry: CrudEntry, sourceFile: string, actionLookup: Awaited<ReturnType<typeof buildActionLookup>> | undefined): ApiLookupEntry {
  const action = actionLookup && entry.paramsTypeName ? actionLookup.methodsByParams.get(entry.paramsTypeName) : undefined;
  const factory = actionLookup && entry.paramsTypeName ? actionLookup.factoriesByParams.get(entry.paramsTypeName) : undefined;
  return {
    ...entry,
    sourceFile,
    paramsJsDoc: entry.paramsTypeDescription,
    paramsFields: mapDocFields(entry.paramsFields),
    resultJsDoc: entry.resultTypeDescription,
    resultFields: mapDocFields(entry.resultFields),
    action,
    factory
  };
}

function mapDocFields(fields: readonly CrudEntryDocField[] | undefined): readonly ApiLookupField[] {
  if (!fields) {
    return [];
  }
  return fields.map((field) => ({
    name: field.name,
    typeText: field.typeText,
    jsDoc: field.description
  }));
}

async function collectApiSources(componentAbs: string): Promise<readonly ApiSource[]> {
  const root = join(componentAbs, COMPONENT_LIB_SUBPATH);
  const files = await listApiFiles(root);
  files.sort((a, b) => a.localeCompare(b));
  const sources: ApiSource[] = [];
  for (const fileAbs of files) {
    const text = await readFile(fileAbs, 'utf8');
    if (!text.includes('callModelFirebaseFunctionMapFactory')) continue;
    const fileRel = relative(componentAbs, fileAbs).split(sep).join('/');
    sources.push({ fileAbs, fileRel, text });
  }
  return sources;
}

async function listApiFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const stats = await stat(root);
    if (!stats.isDirectory()) return [];
  } catch {
    return [];
  }
  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await readDirEntries(current);
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
  return files;
}

async function readDirEntries(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function pickMatchingSource(sources: readonly ApiSource[], modelFilter: string): ApiSource | undefined {
  const wanted = normalize(modelFilter);
  for (const source of sources) {
    const extraction = extractCrudEntries({ name: source.fileRel, text: source.text });
    if (extraction.groupName?.toLowerCase() === wanted) {
      return source;
    }
    for (const modelKey of extraction.modelKeys) {
      if (modelKey.toLowerCase() === wanted) {
        return source;
      }
    }
  }
  return undefined;
}

function entryMatchesFilter(model: string, groupName: string | undefined, filter: string): boolean {
  const wanted = normalize(filter);
  if (model.toLowerCase() === wanted) return true;
  if (groupName?.toLowerCase() === wanted) return true;
  return false;
}

function normalize(value: string): string {
  return value.replace(/Identity$/i, '').toLowerCase();
}
