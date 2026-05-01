/**
 * Parser for the app's `crud.functions.ts` handler map.
 *
 * The convention (see `apps/demo-api/src/app/function/model/crud.functions.ts`):
 *
 * ```ts
 * export const demoCreateModelMap: DemoOnCallCreateModelMap = {
 *   guestbook: createGuestbook,                              // bare handler ref
 *   profile: profileCreate,
 *   storageFile: onCallSpecifierHandler({                    // specifier map
 *     _: storageFileCreate,
 *     fromUpload: storageFileInitializeFromUpload
 *   })
 * };
 * ```
 *
 * For each verb (`Create` / `Read` / `Update` / `Delete` / `Query`), the
 * parser locates the matching `<group><Verb>ModelMap` const and extracts a
 * flat list of `(model, verb, specifier, handlerName, line)` records. A
 * bare handler ref produces a single entry with `specifier === undefined`.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Node, Project, type ObjectLiteralExpression } from 'ts-morph';
import type { HandlerEntry, HandlerMapStatus } from './types.js';
import type { CrudVerb } from '../model-api-shared/types.js';

const HANDLER_MAP_REL = 'src/app/function/model/crud.functions.ts';

const VERB_TOKENS: ReadonlyArray<{ readonly token: string; readonly verb: CrudVerb }> = [
  { token: 'Create', verb: 'create' },
  { token: 'Read', verb: 'read' },
  { token: 'Update', verb: 'update' },
  { token: 'Delete', verb: 'delete' },
  { token: 'Query', verb: 'query' }
];

export interface HandlerExtractionResult {
  readonly path: string;
  readonly status: HandlerMapStatus;
  readonly entries: readonly HandlerEntry[];
}

/**
 * Reads `<apiDir>/src/app/function/model/crud.functions.ts` and returns one
 * handler entry per `(verb, model, specifier)` cell.
 *
 * @param apiAbs - absolute path to the API package root
 * @param apiDir - relative path used in source citations
 * @returns the populated handler entries plus the parse status
 */
export async function extractHandlerEntries(apiAbs: string, apiDir: string): Promise<HandlerExtractionResult> {
  const fullPath = join(apiAbs, HANDLER_MAP_REL);
  const sourceFileRel = `${apiDir}/${HANDLER_MAP_REL}`;
  let text: string;
  try {
    text = await readFile(fullPath, 'utf8');
  } catch {
    return { path: fullPath, status: { kind: 'missing', path: HANDLER_MAP_REL }, entries: [] };
  }

  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(sourceFileRel, text, { overwrite: true });

  const entries: HandlerEntry[] = [];
  const verbsFound: CrudVerb[] = [];

  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      const verb = matchVerbFromConstName(name);
      if (!verb) continue;
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isObjectLiteralExpression(initializer)) continue;
      verbsFound.push(verb);
      collectVerbMap({ verb, mapLiteral: initializer, sourceFileRel, entries });
    }
  }

  return { path: fullPath, status: { kind: 'ok', verbsFound }, entries };
}

function matchVerbFromConstName(name: string): CrudVerb | undefined {
  for (const { token, verb } of VERB_TOKENS) {
    if (name.endsWith(`${token}ModelMap`)) {
      return verb;
    }
  }
  return undefined;
}

interface CollectVerbMapInput {
  readonly verb: CrudVerb;
  readonly mapLiteral: ObjectLiteralExpression;
  readonly sourceFileRel: string;
  readonly entries: HandlerEntry[];
}

function collectVerbMap(input: CollectVerbMapInput): void {
  const { verb, mapLiteral, sourceFileRel, entries } = input;
  for (const prop of mapLiteral.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const model = prop.getName();
    const value = prop.getInitializer();
    if (!value) continue;
    const line = prop.getStartLineNumber();
    const specifierMap = readSpecifierHandler(value);
    if (specifierMap) {
      for (const [specifier, handlerName] of specifierMap) {
        entries.push({ model, verb, specifier, handlerName, sourceFile: sourceFileRel, line });
      }
      continue;
    }
    const handlerName = readBareHandlerName(value);
    if (handlerName) {
      entries.push({ model, verb, specifier: undefined, handlerName, sourceFile: sourceFileRel, line });
    }
  }
}

function readSpecifierHandler(node: Node): ReadonlyMap<string, string> | undefined {
  if (!Node.isCallExpression(node)) return undefined;
  const expr = node.getExpression();
  if (!expr.getText().endsWith('onCallSpecifierHandler')) return undefined;
  const args = node.getArguments();
  if (args.length === 0) return undefined;
  const firstArg = args[0];
  if (!Node.isObjectLiteralExpression(firstArg)) return undefined;
  const out = new Map<string, string>();
  for (const prop of firstArg.getProperties()) {
    if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) continue;
    const specifier = prop.getName();
    const handlerName = readBareHandlerName(Node.isPropertyAssignment(prop) ? prop.getInitializerOrThrow() : prop) ?? '(unresolved)';
    out.set(specifier, handlerName);
  }
  return out;
}

function readBareHandlerName(node: Node): string | undefined {
  if (Node.isIdentifier(node)) return node.getText();
  if (Node.isShorthandPropertyAssignment(node)) return node.getName();
  // Best-effort fallback for inline expressions.
  const text = node.getText().split(/\s|\(/)[0];
  if (/^[A-Za-z_]\w*$/.test(text)) return text;
  return undefined;
}
