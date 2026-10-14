/**
 * Reads the calls an API app actually registers, for the `--api-dir` filter.
 *
 * The app's `<api-dir>/src/app/function/model/crud.functions.ts` handler map is scanned with the
 * same `@dereekb/dbx-cli/manifest-extract` scan `dbx_model_api_validate_app` uses. Declared entries
 * whose `(model, verb, specifier)` the map never wires are dropped from the manifest, so the CLI does
 * not offer calls the server answers with `Invalid type to …`.
 *
 * Entries are compared with `mcpManifestKey`, the key the MCP runtime joins manifest entries on: an
 * absent specifier and `_` are the same call, and a bare (non-specifier) handler serves `_` only.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CALL_MODEL_HANDLER_MAP_PATH, extractCallModelHandlerMap, type CallModelHandlerMapExtraction, type CrudVerb } from '@dereekb/dbx-cli/manifest-extract';
import { mcpManifestKey } from '../../../src/lib/manifest/types.js';
import { relPath } from './resolve-package';
import type { CrudEntry, RegisteredCalls } from './types';

/**
 * Input to {@link makeRegisteredCalls}.
 */
export interface MakeRegisteredCallsInput {
  /**
   * Workspace-relative handler-map path, for log lines.
   */
  readonly handlerMapFile: string;
  readonly extraction: CallModelHandlerMapExtraction;
}

/**
 * Indexes a handler-map extraction for {@link isRegisteredCall}.
 *
 * @param input - The handler-map path and its extraction.
 * @returns The registered call keys plus the verbs / models the scan could not read.
 */
export function makeRegisteredCalls(input: MakeRegisteredCallsInput): RegisteredCalls {
  const { handlerMapFile, extraction } = input;
  const callKeys = new Set(extraction.cells.map((x) => mcpManifestKey(x.model, x.verb, x.specifier)));
  const opaqueVerbs = new Set<CrudVerb>();
  const opaqueModelCalls = new Set<string>();

  for (const x of extraction.opaque) {
    if (x.model === undefined) {
      opaqueVerbs.add(x.verb);
    } else {
      opaqueModelCalls.add(opaqueModelCallKey(x.verb, x.model));
    }
  }

  return { handlerMapFile, callKeys, opaqueVerbs, opaqueModelCalls, opaque: extraction.opaque, verbsFound: extraction.verbsFound };
}

/**
 * Whether the handler map serves a declared entry. Entries under a verb or model the scan could not
 * read count as registered.
 *
 * @param registered - The app's registered calls.
 * @param entry - The declared entry.
 * @returns `true` when the app wires the entry, or when its verb / model is opaque.
 */
export function isRegisteredCall(registered: RegisteredCalls, entry: Pick<CrudEntry, 'model' | 'verb' | 'specifier'>): boolean {
  return registered.opaqueVerbs.has(entry.verb) || registered.opaqueModelCalls.has(opaqueModelCallKey(entry.verb, entry.model)) || registered.callKeys.has(mcpManifestKey(entry.model, entry.verb, entry.specifier));
}

/**
 * Input to {@link readRegisteredCalls}.
 */
export interface ReadRegisteredCallsInput {
  readonly workspaceRoot: string;
  /**
   * Absolute path to the API app root.
   */
  readonly apiDir: string;
}

/**
 * Reads and indexes `<apiDir>/src/app/function/model/crud.functions.ts`.
 *
 * @param input - The workspace root and the API app root.
 * @returns The app's registered calls.
 * @throws {Error} When the handler map is missing, or declares no verb maps.
 */
export function readRegisteredCalls(input: ReadRegisteredCallsInput): RegisteredCalls {
  const { workspaceRoot, apiDir } = input;
  const handlerMapPath = join(apiDir, CALL_MODEL_HANDLER_MAP_PATH);
  const handlerMapFile = relPath(workspaceRoot, handlerMapPath);

  if (!existsSync(handlerMapPath)) {
    throw new Error(`--api-dir handler map not found: ${handlerMapFile}`);
  }

  const extraction = extractCallModelHandlerMap({ name: handlerMapPath, text: readFileSync(handlerMapPath, 'utf8') });

  if (extraction.verbsFound.length === 0 && extraction.opaque.length === 0) {
    throw new Error(`--api-dir handler map ${handlerMapFile} declares no <APP>_<VERB>_MODEL_MAP / <app><Verb>ModelMap consts.`);
  }

  return makeRegisteredCalls({ handlerMapFile, extraction });
}

function opaqueModelCallKey(verb: CrudVerb, model: string): string {
  return `${verb}:${model}`;
}
