/**
 * Pure entry point for `dbx_model_api_lookup`.
 */

import { extractApiLookup } from './extract.js';
import type { ApiLookupReport } from './types.js';

export interface LookupApiOptions {
  readonly componentAbs: string;
  readonly componentDir: string;
  readonly apiAbs?: string;
  readonly apiDir?: string;
  readonly modelFilter: string;
}

/**
 * Builds the deep-detail report for one model declared in a firebase-component
 * package, optionally enriched with action/factory JSDoc from a paired API app.
 *
 * @param options - resolved paths and the model filter
 * @returns the populated report
 */
export async function lookupModelApi(options: LookupApiOptions): Promise<ApiLookupReport> {
  return extractApiLookup({
    componentAbs: options.componentAbs,
    componentDir: options.componentDir,
    apiAbs: options.apiAbs,
    apiDir: options.apiDir,
    modelFilter: options.modelFilter
  });
}

export { formatLookupAsJson, formatLookupAsMarkdown } from './format.js';
export type { ApiLookupEntry, ApiLookupField, ApiLookupReport, ActionLookupStatus, ActionResolution, FactoryResolution } from './types.js';
