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
 * shared `extractCallModelHandlerMapFromSourceFile` scan (`@dereekb/dbx-cli/manifest-extract`,
 * also behind the `firebase-api-manifest` `--api-dir` filter) locates the matching
 * `<group><Verb>ModelMap` const and extracts a flat list of
 * `(model, verb, specifier, handlerName, line)` records. A bare handler ref
 * produces a single entry with `specifier === undefined`.
 *
 * The parser reads every `.ts` file under `<apiDir>/src/app/function/`, so it
 * can follow each `invoke` / custom-verb handler (whose call type leaves the MCP
 * read/write classification to the handler) back to its `withApiDetails({ ... })`
 * declaration and record the `mcp.readOnly` it declares
 * ({@link HandlerEntry.mcpReadOnly}, see `extract-handler-mcp.ts`).
 */

import { join } from 'node:path';
import type { Node, SourceFile } from 'ts-morph';
import type { HandlerEntry, HandlerMapStatus } from './types.js';
import { CALL_MODEL_HANDLER_MAP_PATH, extractCallModelHandlerMapFromSourceFile, type CrudVerb } from '@dereekb/dbx-cli/manifest-extract';
import { apiRelPath, buildInMemoryProject } from '../_core/_validate/ast.js';
import { collectTsFiles } from '../_core/_validate/inspect.js';
import type { InspectedFile } from '../_core/_validate/inspection.types.js';
import { buildHandlerMcpReadOnlyContext, readHandlerMcpReadOnly } from './extract-handler-mcp.js';
import { isMcpReadOnlyInferredVerb } from './mcp-read-only.js';

/**
 * The API folder the handler walk reads, relative to the API package root.
 */
const FUNCTION_DIR_REL = 'src/app/function';

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
  const fullPath = join(apiAbs, CALL_MODEL_HANDLER_MAP_PATH);
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files } });
  const sourceFile = apiSources.find((x) => apiRelPath(x) === CALL_MODEL_HANDLER_MAP_PATH);
  let result: HandlerExtractionResult;
  if (sourceFile === undefined) {
    result = { path: fullPath, status: { kind: 'missing', path: CALL_MODEL_HANDLER_MAP_PATH }, entries: [] };
  } else {
    const { handlers, verbsFound } = collectHandlerMap(sourceFile, `${apiDir}/${CALL_MODEL_HANDLER_MAP_PATH}`);
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
 * Flattens the handler-map source into `(model, verb, specifier, handler)` records through the
 * shared `@dereekb/dbx-cli/manifest-extract` scan, so validate and the `firebase-api-manifest`
 * `--api-dir` filter agree on what is registered. Constructs the scan reports as opaque are ignored here.
 *
 * @param sourceFile - The parsed `crud.functions.ts` source.
 * @param sourceFileRel - Relative path used in emitted source citations.
 * @returns The flattened handler records and the verbs whose maps were found.
 */
function collectHandlerMap(sourceFile: SourceFile, sourceFileRel: string): CollectedHandlerMap {
  const { cells, verbsFound } = extractCallModelHandlerMapFromSourceFile(sourceFile);
  const handlers = cells.map(({ reference, ...cell }) => ({ entry: { model: cell.model, verb: cell.verb, specifier: cell.specifier, handlerName: cell.handlerName, sourceFile: sourceFileRel, line: cell.line }, reference }));
  return { handlers, verbsFound };
}
