/**
 * Pure entry point for `dbx_model_api_list_app`.
 */

import { extractApiList } from './extract.js';
import type { ApiListReport } from './types.js';

export interface ListAppModelApiOptions {
  readonly componentDir: string;
  readonly modelFilter?: string;
}

/**
 * Walks a firebase-component package's `<model>.api.ts` files and returns a
 * flat list of CRUD / standalone entries with per-file summaries.
 *
 * @param componentAbs - absolute path to the firebase-component package root
 * @param options - relative path used in the report and optional model filter
 * @returns the populated report
 */
export async function listAppModelApi(componentAbs: string, options: ListAppModelApiOptions): Promise<ApiListReport> {
  const extraction = await extractApiList({ componentAbs, componentDir: options.componentDir, modelFilter: options.modelFilter });
  const result: ApiListReport = {
    componentDir: options.componentDir,
    modelRoot: extraction.modelRoot,
    entries: extraction.entries,
    files: extraction.files,
    modelFilter: options.modelFilter
  };
  return result;
}

export { formatReportAsJson, formatReportAsMarkdown } from './format.js';
export type { ApiListEntry, ApiListFileSummary, ApiListReport, ApiListVerbCounts } from './types.js';
