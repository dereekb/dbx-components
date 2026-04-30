/**
 * Pure entry point for `dbx_server_actions_list_app`.
 */

import { extractServerActions } from './extract.js';
import type { ServerActionsReport } from './types.js';

export interface ListServerActionsOptions {
  readonly apiDir: string;
}

/**
 * Walks the API app's `src/app/common/model/**\/*.action.server.ts`
 * files, extracts every `*ServerActions` abstract class, and
 * cross-references each with its sibling NestJS module, the common
 * barrel, and the test fixture file.
 *
 * @param apiAbs - absolute path to the API package root
 * @param options - relative path used in the report
 * @returns the populated report
 */
export async function listAppServerActions(apiAbs: string, options: ListServerActionsOptions): Promise<ServerActionsReport> {
  const extraction = await extractServerActions(apiAbs, options.apiDir);
  const result: ServerActionsReport = {
    apiDir: options.apiDir,
    modelRoot: extraction.modelRoot,
    entries: extraction.entries,
    fixtureStatus: extraction.fixtureStatus
  };
  return result;
}

export { formatReportAsJson, formatReportAsMarkdown } from './format.js';
export type { ServerActionEntry, ServerActionFixtureCoverage, ServerActionModuleWiring, ServerActionsReport } from './types.js';
