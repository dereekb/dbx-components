/**
 * Walker for `dbx_model_api_lookup`. Resolves the right `<model>.api.ts`
 * source for a model filter, runs the shared CRUD walker, and enriches
 * each entry with:
 *   - Params interface JSDoc + per-field docs.
 *   - Result interface JSDoc + per-field docs (when applicable).
 *   - Action method / factory JSDoc, when an `apiDir` was provided.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { Project, type InterfaceDeclaration, type SourceFile } from 'ts-morph';
import { extractCrudEntries } from '../model-api-shared/index.js';
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
 * @param input - the absolute / relative paths and the model filter
 * @returns the populated report
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

  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(matched.fileRel, matched.text, { overwrite: true });
  const interfaces = collectInterfacesByName(sourceFile);

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

  const enriched: ApiLookupEntry[] = filteredEntries.map((entry) => {
    const paramsInterface = entry.paramsTypeName ? interfaces.get(entry.paramsTypeName) : undefined;
    const resultInterface = entry.resultTypeName ? interfaces.get(entry.resultTypeName) : undefined;
    const action = actionLookup && entry.paramsTypeName ? actionLookup.methodsByParams.get(entry.paramsTypeName) : undefined;
    const factory = actionLookup && entry.paramsTypeName ? actionLookup.factoriesByParams.get(entry.paramsTypeName) : undefined;
    return {
      ...entry,
      sourceFile: matched.fileRel,
      paramsJsDoc: paramsInterface ? readInterfaceJsDoc(paramsInterface) : undefined,
      paramsFields: paramsInterface ? extractInterfaceFields(paramsInterface) : [],
      resultJsDoc: resultInterface ? readInterfaceJsDoc(resultInterface) : undefined,
      resultFields: resultInterface ? extractInterfaceFields(resultInterface) : [],
      action,
      factory
    };
  });

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

async function collectApiSources(componentAbs: string): Promise<readonly ApiSource[]> {
  const root = join(componentAbs, COMPONENT_LIB_SUBPATH);
  const files: string[] = [];
  const stack: string[] = [];
  try {
    const stats = await stat(root);
    if (!stats.isDirectory()) return [];
    stack.push(root);
  } catch {
    return [];
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
      if (!entry.isFile()) continue;
      if (entry.name.endsWith(API_SUFFIX) && !entry.name.endsWith('.spec.ts')) {
        files.push(full);
      }
    }
  }
  files.sort((a, b) => a.localeCompare(b));
  const sources: ApiSource[] = [];
  for (const fileAbs of files) {
    const text = await readFile(fileAbs, 'utf8');
    if (!text.includes('callModelFirebaseFunctionMapFactory')) {
      continue;
    }
    const fileRel = relative(componentAbs, fileAbs).split(sep).join('/');
    sources.push({ fileAbs, fileRel, text });
  }
  return sources;
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

function collectInterfacesByName(sourceFile: SourceFile): ReadonlyMap<string, InterfaceDeclaration> {
  const out = new Map<string, InterfaceDeclaration>();
  for (const iface of sourceFile.getInterfaces()) {
    out.set(iface.getName(), iface);
  }
  return out;
}

function readInterfaceJsDoc(iface: InterfaceDeclaration): string | undefined {
  const docs = iface.getJsDocs();
  if (docs.length === 0) return undefined;
  const last = docs[docs.length - 1];
  const description = last.getDescription().trim();
  return description.length > 0 ? description : undefined;
}

function extractInterfaceFields(iface: InterfaceDeclaration): readonly ApiLookupField[] {
  const fields: ApiLookupField[] = [];
  for (const prop of iface.getProperties()) {
    const typeNode = prop.getTypeNode();
    const docs = prop.getJsDocs();
    let jsDoc: string | undefined;
    if (docs.length > 0) {
      const last = docs[docs.length - 1];
      const description = last.getDescription().trim();
      jsDoc = description.length > 0 ? description : undefined;
    }
    fields.push({
      name: prop.getName(),
      typeText: typeNode ? typeNode.getText() : '',
      jsDoc
    });
  }
  return fields;
}
