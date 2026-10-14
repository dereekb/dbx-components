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
 * For each verb (`Create` / `Read` / `Update` / `Delete` / `Query` / `Invoke`), the
 * parser locates the matching `<group><Verb>ModelMap` const and extracts a
 * flat list of `(model, verb, specifier, handlerName, line)` records. A
 * bare handler ref produces a single entry with `specifier === undefined`.
 *
 * The parser reads every `.ts` file under `<apiDir>/src/app/function/`, so it
 * can follow each `invoke` / custom-verb handler (whose call type leaves the MCP
 * read/write classification to the handler) back to its `withApiDetails({ ... })`
 * declaration and record the `mcp.readOnly` it declares
 * ({@link HandlerEntry.mcpReadOnly}, see `extract-handler-mcp.ts`).
 */

import { join } from 'node:path';
import { Node, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import type { HandlerEntry, HandlerMapStatus } from './types.js';
import type { CrudVerb } from '@dereekb/dbx-cli/manifest-extract';
import { apiRelPath, buildInMemoryProject, unwrapOuterExpressions } from '../_core/_validate/ast.js';
import { collectTsFiles } from '../_core/_validate/inspect.js';
import type { InspectedFile } from '../_core/_validate/inspection.types.js';
import { buildHandlerMcpReadOnlyContext, readHandlerMcpReadOnly } from './extract-handler-mcp.js';
import { isMcpReadOnlyInferredVerb } from './mcp-read-only.js';

const HANDLER_MAP_REL = 'src/app/function/model/crud.functions.ts';

/**
 * The API folder the handler walk reads, relative to the API package root.
 */
const FUNCTION_DIR_REL = 'src/app/function';

const VERB_TOKENS: ReadonlyArray<{ readonly token: string; readonly verb: CrudVerb }> = [
  { token: 'Create', verb: 'create' },
  { token: 'Read', verb: 'read' },
  { token: 'Update', verb: 'update' },
  { token: 'Delete', verb: 'delete' },
  { token: 'Query', verb: 'query' },
  { token: 'Invoke', verb: 'invoke' }
];

export interface HandlerExtractionResult {
  readonly path: string;
  readonly status: HandlerMapStatus;
  readonly entries: readonly HandlerEntry[];
}

/**
 * Reads every `.ts` file under `<apiDir>/src/app/function/` and returns one
 * handler entry per `(verb, model, specifier)` cell of its
 * `model/crud.functions.ts` (see {@link extractHandlerEntriesFromFiles}).
 *
 * @param apiAbs - Absolute path to the API package root.
 * @param apiDir - Relative path used in source citations.
 * @returns The populated handler entries plus the parse status.
 */
export async function extractHandlerEntries(apiAbs: string, apiDir: string): Promise<HandlerExtractionResult> {
  const files = await collectTsFiles(join(apiAbs, FUNCTION_DIR_REL), apiAbs);
  return extractHandlerEntriesFromFiles({ files, apiAbs, apiDir });
}

/**
 * Input to {@link extractHandlerEntriesFromFiles}.
 */
export interface ExtractHandlerEntriesFromFilesInput {
  /**
   * The API files, keyed by path relative to the API package root (`src/app/function/...`).
   */
  readonly files: readonly InspectedFile[];
  /**
   * Absolute path to the API package root; only used to report the handler map's path.
   */
  readonly apiAbs: string;
  /**
   * Relative path used in source citations.
   */
  readonly apiDir: string;
}

/**
 * Parses `src/app/function/model/crud.functions.ts` out of the supplied API
 * files and returns one handler entry per `(verb, model, specifier)` cell.
 * Each `invoke` / custom-verb entry also carries how its handler's
 * `withApiDetails({ ... })` declares `mcp.readOnly`.
 *
 * @param input - The API files plus the paths used in citations.
 * @returns The populated handler entries plus the parse status.
 */
export function extractHandlerEntriesFromFiles(input: ExtractHandlerEntriesFromFilesInput): HandlerExtractionResult {
  const { files, apiAbs, apiDir } = input;
  const fullPath = join(apiAbs, HANDLER_MAP_REL);
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files } });
  const sourceFile = apiSources.find((x) => apiRelPath(x) === HANDLER_MAP_REL);
  let result: HandlerExtractionResult;
  if (sourceFile === undefined) {
    result = { path: fullPath, status: { kind: 'missing', path: HANDLER_MAP_REL }, entries: [] };
  } else {
    const { handlers, verbsFound } = collectHandlerMap(sourceFile, `${apiDir}/${HANDLER_MAP_REL}`);
    const context = buildHandlerMcpReadOnlyContext({ sources: apiSources, apiDir });
    const entries = handlers.map(({ entry, reference }) => (isMcpReadOnlyInferredVerb(entry.verb) ? entry : { ...entry, mcpReadOnly: readHandlerMcpReadOnly(reference, context) }));
    result = { path: fullPath, status: { kind: 'ok', verbsFound }, entries };
  }
  return result;
}

/**
 * One verb-map cell plus the node its handler is referenced by: the value (wrappers unwrapped) or a shorthand
 * specifier's name node. Internal only — {@link HandlerEntry} stays plain data.
 */
interface CollectedHandler {
  readonly entry: HandlerEntry;
  readonly reference: Node;
}

interface CollectedHandlerMap {
  readonly handlers: readonly CollectedHandler[];
  readonly verbsFound: readonly CrudVerb[];
}

/**
 * Walks every `<group><Verb>ModelMap` const in the handler-map source and
 * flattens each into `(model, verb, specifier, handler)` records.
 *
 * @param sourceFile - The parsed `crud.functions.ts` source.
 * @param sourceFileRel - Relative path used in emitted source citations.
 * @returns The flattened handler records and the verbs whose maps were found.
 */
function collectHandlerMap(sourceFile: SourceFile, sourceFileRel: string): CollectedHandlerMap {
  const handlers: CollectedHandler[] = [];
  const verbsFound: CrudVerb[] = [];
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      const verb = matchVerbFromConstName(name);
      if (!verb) continue;
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isObjectLiteralExpression(initializer)) continue;
      verbsFound.push(verb);
      collectVerbMap({ verb, mapLiteral: initializer, sourceFileRel, handlers });
    }
  }
  return { handlers, verbsFound };
}

function matchVerbFromConstName(name: string): CrudVerb | undefined {
  for (const { token, verb } of VERB_TOKENS) {
    if (name.endsWith(`${token}ModelMap`) || name.endsWith(`_${token.toUpperCase()}_MODEL_MAP`)) {
      return verb;
    }
  }
  return undefined;
}

interface CollectVerbMapInput {
  readonly verb: CrudVerb;
  readonly mapLiteral: ObjectLiteralExpression;
  readonly sourceFileRel: string;
  readonly handlers: CollectedHandler[];
}

function collectVerbMap(input: CollectVerbMapInput): void {
  const { verb, mapLiteral, sourceFileRel, handlers } = input;
  for (const prop of mapLiteral.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const model = prop.getName();
    const value = prop.getInitializer();
    if (!value) continue;
    const line = prop.getStartLineNumber();
    const specifierMap = readSpecifierHandler(value);
    if (specifierMap) {
      for (const [specifier, { handlerName, reference }] of specifierMap) {
        handlers.push({ entry: { model, verb, specifier, handlerName, sourceFile: sourceFileRel, line }, reference });
      }
      continue;
    }
    const handlerName = readBareHandlerName(value);
    if (handlerName) {
      handlers.push({ entry: { model, verb, specifier: undefined, handlerName, sourceFile: sourceFileRel, line }, reference: unwrapOuterExpressions(value) });
    }
  }
}

interface SpecifierHandler {
  readonly handlerName: string;
  readonly reference: Node;
}

function readSpecifierHandler(node: Node): ReadonlyMap<string, SpecifierHandler> | undefined {
  if (!Node.isCallExpression(node)) return undefined;
  const expr = node.getExpression();
  if (!expr.getText().endsWith('onCallSpecifierHandler')) return undefined;
  const args = node.getArguments();
  if (args.length === 0) return undefined;
  const firstArg = args[0];
  if (!Node.isObjectLiteralExpression(firstArg)) return undefined;
  const out = new Map<string, SpecifierHandler>();
  for (const prop of firstArg.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const value = prop.getInitializerOrThrow();
      out.set(prop.getName(), { handlerName: readBareHandlerName(value) ?? '(unresolved)', reference: unwrapOuterExpressions(value) });
    } else if (Node.isShorthandPropertyAssignment(prop)) {
      out.set(prop.getName(), { handlerName: prop.getName(), reference: prop.getNameNode() });
    }
  }
  return out;
}

function readBareHandlerName(node: Node): string | undefined {
  if (Node.isIdentifier(node)) return node.getText();
  // Best-effort fallback for inline expressions.
  const text = node.getText().split(/\s|\(/)[0];
  if (/^[A-Za-z_]\w*$/.test(text)) return text;
  return undefined;
}
