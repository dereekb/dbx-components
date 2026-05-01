/**
 * Walks the firebase-component package's `<model>.api.ts` files and emits
 * one {@link DeclaredEntry} per CRUD leaf (standalone entries are skipped —
 * they are not registered through the verb-keyed `<X>ModelMap` constants
 * the validator reconciles against).
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { extractCrudEntries } from '../model-api-shared/index.js';
import type { DeclaredEntry } from './types.js';

const API_SUFFIX = '.api.ts';
const COMPONENT_LIB_SUBPATH = 'src/lib';

export async function extractDeclaredEntries(componentAbs: string): Promise<readonly DeclaredEntry[]> {
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
  files.sort();

  const out: DeclaredEntry[] = [];
  for (const fileAbs of files) {
    const text = await readFile(fileAbs, 'utf8');
    if (!text.includes('callModelFirebaseFunctionMapFactory')) continue;
    const fileRel = relative(componentAbs, fileAbs).split(sep).join('/');
    const extraction = extractCrudEntries({ name: fileRel, text });
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
  }
  return out;
}
